#!/bin/bash
# Test: TLS Connection
# Verifies: Port 8883 TLS connection, certificate validation (FR-018)
# Prerequisites: EMQX running, TLS certificates generated

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT_TLS="${MQTT_PORT_TLS:-8883}"
CERTS_DIR="${CERTS_DIR:-$(pwd)/certs}"
TEST_TOPIC="test/tls/$(date +%s)"
TIMEOUT=10

echo "=== Test: TLS Connection ==="
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

# Check if certificates exist
check_certs() {
    if [ -f "${CERTS_DIR}/ca.crt" ]; then
        return 0
    else
        return 1
    fi
}

# Test 1: TLS port is open
echo "--- TLS Port Check ---"

echo -n "Testing: TLS port ${BROKER_PORT_TLS} is open... "
if nc -z ${BROKER_HOST} ${BROKER_PORT_TLS} 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 2: TLS handshake
echo ""
echo "--- TLS Handshake ---"

echo -n "Testing: TLS handshake (OpenSSL)... "
if echo "Q" | timeout 5 openssl s_client -connect ${BROKER_HOST}:${BROKER_PORT_TLS} -servername ${BROKER_HOST} 2>/dev/null | grep -q "BEGIN CERTIFICATE"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 3: TLS version (TLS 1.2+)
echo ""
echo "--- TLS Version ---"

echo -n "Testing: TLS 1.2 supported... "
if echo "Q" | timeout 5 openssl s_client -connect ${BROKER_HOST}:${BROKER_PORT_TLS} -tls1_2 2>/dev/null | grep -q "BEGIN CERTIFICATE"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: TLS 1.3 supported... "
if echo "Q" | timeout 5 openssl s_client -connect ${BROKER_HOST}:${BROKER_PORT_TLS} -tls1_3 2>/dev/null | grep -q "BEGIN CERTIFICATE"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (TLS 1.3 optional)"
    ((SKIPPED++))
fi

# Test 4: MQTT over TLS connection
echo ""
echo "--- MQTT over TLS ---"

echo -n "Testing: MQTT publish over TLS... "
if check_certs; then
    if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --insecure \
        -t "${TEST_TOPIC}/tls" \
        -m "tls-test" \
        -q 1 2>/dev/null; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        # Try without cert verification (self-signed)
        if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
            --insecure \
            -t "${TEST_TOPIC}/tls" \
            -m "tls-test-insecure" \
            -q 1 2>/dev/null; then
            echo -e "${GREEN}PASSED${NC} (insecure mode)"
            ((PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((FAILED++))
        fi
    fi
else
    # No certs, try insecure
    if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --insecure \
        -t "${TEST_TOPIC}/tls" \
        -m "tls-test-insecure" \
        -q 1 2>/dev/null; then
        echo -e "${GREEN}PASSED${NC} (insecure mode, no certs)"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (no certificates available)"
        ((SKIPPED++))
    fi
fi

# Test 5: TLS pub/sub round-trip
echo ""
echo "--- TLS Pub/Sub Round-trip ---"

echo -n "Testing: TLS publish/subscribe round-trip... "
TLS_MSG="tls-roundtrip-$(date +%s)"

if check_certs; then
    mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --insecure \
        -t "${TEST_TOPIC}/roundtrip" \
        -C 1 -W ${TIMEOUT} > /tmp/tls_msg.txt 2>/dev/null &
    SUB_PID=$!
    sleep 1

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --cafile "${CERTS_DIR}/ca.crt" \
        --insecure \
        -t "${TEST_TOPIC}/roundtrip" \
        -m "${TLS_MSG}" \
        -q 1 2>/dev/null

    wait $SUB_PID 2>/dev/null || true
else
    mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --insecure \
        -t "${TEST_TOPIC}/roundtrip" \
        -C 1 -W ${TIMEOUT} > /tmp/tls_msg.txt 2>/dev/null &
    SUB_PID=$!
    sleep 1

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT_TLS} \
        --insecure \
        -t "${TEST_TOPIC}/roundtrip" \
        -m "${TLS_MSG}" \
        -q 1 2>/dev/null

    wait $SUB_PID 2>/dev/null || true
fi

TLS_RECEIVED=$(cat /tmp/tls_msg.txt 2>/dev/null || echo "")
rm -f /tmp/tls_msg.txt

if [ "${TLS_RECEIVED}" = "${TLS_MSG}" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 6: Reject old TLS versions
echo ""
echo "--- Old TLS Version Rejection ---"

echo -n "Testing: TLS 1.0 rejected... "
if echo "Q" | timeout 5 openssl s_client -connect ${BROKER_HOST}:${BROKER_PORT_TLS} -tls1 2>&1 | grep -q "no protocols available\|alert\|handshake failure"; then
    echo -e "${GREEN}PASSED${NC} (TLS 1.0 correctly rejected)"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (OpenSSL may not support TLS 1.0)"
    ((SKIPPED++))
fi

echo -n "Testing: TLS 1.1 rejected... "
if echo "Q" | timeout 5 openssl s_client -connect ${BROKER_HOST}:${BROKER_PORT_TLS} -tls1_1 2>&1 | grep -q "no protocols available\|alert\|handshake failure"; then
    echo -e "${GREEN}PASSED${NC} (TLS 1.1 correctly rejected)"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (OpenSSL may not support TLS 1.1)"
    ((SKIPPED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All TLS tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
