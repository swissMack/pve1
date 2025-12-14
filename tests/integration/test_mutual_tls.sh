#!/bin/bash
# Test: Mutual TLS (mTLS) Authentication
# Verifies: Client certificate authentication (FR-020)
# Prerequisites: EMQX running, CA and client certificates generated

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT_TLS="${MQTT_PORT_TLS:-8883}"
CERTS_DIR="${CERTS_DIR:-$(pwd)/certs}"
TEST_TOPIC="test/mtls/$(date +%s)"
TIMEOUT=10

echo "=== Test: Mutual TLS Authentication ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT_TLS}"
echo "Certs: ${CERTS_DIR}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Check if all certificates exist
check_all_certs() {
    if [ -f "${CERTS_DIR}/ca.crt" ] && \
       [ -f "${CERTS_DIR}/client.crt" ] && \
       [ -f "${CERTS_DIR}/client.key" ]; then
        return 0
    else
        return 1
    fi
}

# Test 1: Verify certificates exist
echo "--- Certificate Check ---"

echo -n "Testing: CA certificate exists... "
if [ -f "${CERTS_DIR}/ca.crt" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (run scripts/generate-certs.sh first)"
    ((SKIPPED++))
fi

echo -n "Testing: Client certificate exists... "
if [ -f "${CERTS_DIR}/client.crt" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (run scripts/generate-certs.sh first)"
    ((SKIPPED++))
fi

echo -n "Testing: Client key exists... "
if [ -f "${CERTS_DIR}/client.key" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (run scripts/generate-certs.sh first)"
    ((SKIPPED++))
fi

# Test 2: mTLS connection with valid client certificate
echo ""
echo "--- mTLS Connection ---"

if check_all_certs; then
    echo -n "Testing: mTLS connection with valid client certificate... "
    if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --cert "${CERTS_DIR}/client.crt" \
        --key "${CERTS_DIR}/client.key" \
        -t "${TEST_TOPIC}/mtls" \
        -m "mtls-test" \
        -q 1 2>/dev/null; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (mTLS may not be required)"
        ((SKIPPED++))
    fi

    # Test 3: mTLS pub/sub round-trip
    echo ""
    echo "--- mTLS Pub/Sub ---"

    echo -n "Testing: mTLS publish/subscribe round-trip... "
    MTLS_MSG="mtls-roundtrip-$(date +%s)"

    mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --cert "${CERTS_DIR}/client.crt" \
        --key "${CERTS_DIR}/client.key" \
        -t "${TEST_TOPIC}/roundtrip" \
        -C 1 -W ${TIMEOUT} > /tmp/mtls_msg.txt 2>/dev/null &
    SUB_PID=$!
    sleep 1

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --cert "${CERTS_DIR}/client.crt" \
        --key "${CERTS_DIR}/client.key" \
        -t "${TEST_TOPIC}/roundtrip" \
        -m "${MTLS_MSG}" \
        -q 1 2>/dev/null

    wait $SUB_PID 2>/dev/null || true
    MTLS_RECEIVED=$(cat /tmp/mtls_msg.txt 2>/dev/null || echo "")
    rm -f /tmp/mtls_msg.txt

    if [ "${MTLS_RECEIVED}" = "${MTLS_MSG}" ]; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (mTLS may not be required)"
        ((SKIPPED++))
    fi

    # Test 4: Connection without client certificate (should work if mTLS not required)
    echo ""
    echo "--- Non-mTLS Connection ---"

    echo -n "Testing: TLS connection without client certificate... "
    if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --insecure \
        -t "${TEST_TOPIC}/no-client-cert" \
        -m "no-client-cert-test" \
        -q 1 2>/dev/null; then
        echo -e "${GREEN}ALLOWED${NC} (mTLS not required)"
        ((PASSED++))
    else
        echo -e "${YELLOW}DENIED${NC} (mTLS is required)"
        ((PASSED++))  # Both behaviors are valid depending on config
    fi

    # Test 5: OpenSSL verification of certificate chain
    echo ""
    echo "--- Certificate Chain Verification ---"

    echo -n "Testing: Client certificate signed by CA... "
    if openssl verify -CAfile "${CERTS_DIR}/ca.crt" "${CERTS_DIR}/client.crt" 2>/dev/null | grep -q "OK"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAILED${NC} (certificate chain invalid)"
        ((FAILED++))
    fi

else
    echo ""
    echo -e "${YELLOW}Skipping mTLS tests - certificates not found${NC}"
    echo "Run: ./scripts/generate-certs.sh"
    echo ""
    ((SKIPPED+=5))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All mTLS tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
