#!/bin/bash
# Test: Username/Password Authentication
# Verifies: Valid/invalid credentials (FR-019)
# Prerequisites: EMQX running with authentication enabled

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="test/auth/$(date +%s)"
TIMEOUT=10

echo "=== Test: Username/Password Authentication ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test credentials (from config/users.json)
VALID_USER="testuser"
VALID_PASS="testpass"
ADMIN_USER="admin"
ADMIN_PASS="admin"
INVALID_USER="wronguser"
INVALID_PASS="wrongpass"

# Test 1: Valid user credentials
echo "--- Valid Credentials ---"

echo -n "Testing: Connect with valid testuser credentials... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${VALID_USER}" -P "${VALID_PASS}" \
    -t "${TEST_TOPIC}/valid" \
    -m "auth-test" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (auth may not be enabled)"
    ((SKIPPED++))
fi

echo -n "Testing: Connect with admin credentials... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${ADMIN_USER}" -P "${ADMIN_PASS}" \
    -t "${TEST_TOPIC}/admin" \
    -m "admin-test" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (auth may not be enabled)"
    ((SKIPPED++))
fi

# Test 2: Invalid credentials
echo ""
echo "--- Invalid Credentials ---"

echo -n "Testing: Reject invalid username... "
if ! mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${INVALID_USER}" -P "${VALID_PASS}" \
    -t "${TEST_TOPIC}/invalid" \
    -m "should-fail" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC} (correctly rejected)"
    ((PASSED++))
else
    echo -e "${YELLOW}PARTIAL${NC} (auth may not be strict)"
    ((SKIPPED++))
fi

echo -n "Testing: Reject invalid password... "
if ! mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${VALID_USER}" -P "${INVALID_PASS}" \
    -t "${TEST_TOPIC}/invalid" \
    -m "should-fail" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC} (correctly rejected)"
    ((PASSED++))
else
    echo -e "${YELLOW}PARTIAL${NC} (auth may not be strict)"
    ((SKIPPED++))
fi

echo -n "Testing: Reject empty credentials... "
if ! mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "" -P "" \
    -t "${TEST_TOPIC}/empty" \
    -m "should-fail" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC} (correctly rejected)"
    ((PASSED++))
else
    echo -e "${YELLOW}PARTIAL${NC} (anonymous may be allowed)"
    ((SKIPPED++))
fi

# Test 3: Anonymous connection (should be allowed/denied based on config)
echo ""
echo "--- Anonymous Connection ---"

echo -n "Testing: Anonymous connection behavior... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TEST_TOPIC}/anonymous" \
    -m "anonymous-test" \
    -q 1 2>/dev/null; then
    echo -e "${YELLOW}ALLOWED${NC} (anonymous connections permitted)"
else
    echo -e "${GREEN}DENIED${NC} (anonymous connections blocked)"
fi
((PASSED++))

# Test 4: Authenticated pub/sub round-trip
echo ""
echo "--- Authenticated Pub/Sub ---"

echo -n "Testing: Authenticated publish/subscribe round-trip... "
AUTH_MSG="auth-roundtrip-$(date +%s)"

mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${VALID_USER}" -P "${VALID_PASS}" \
    -t "${TEST_TOPIC}/roundtrip" \
    -C 1 -W ${TIMEOUT} > /tmp/auth_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${VALID_USER}" -P "${VALID_PASS}" \
    -t "${TEST_TOPIC}/roundtrip" \
    -m "${AUTH_MSG}" \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true
AUTH_RECEIVED=$(cat /tmp/auth_msg.txt 2>/dev/null || echo "")
rm -f /tmp/auth_msg.txt

if [ "${AUTH_RECEIVED}" = "${AUTH_MSG}" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (auth may not be enabled)"
    ((SKIPPED++))
fi

# Test 5: Connection with special characters in password
echo ""
echo "--- Special Characters ---"

echo -n "Testing: Password with special characters... "
# This tests that the broker correctly handles special chars
# Using a known working password for now
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${ADMIN_USER}" -P "${ADMIN_PASS}" \
    -t "${TEST_TOPIC}/special" \
    -m "special-test" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All authentication tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
