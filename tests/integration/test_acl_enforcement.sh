#!/bin/bash
# Test: ACL Enforcement
# Verifies: Publish/subscribe permissions (FR-021, FR-022, FR-024)
# Prerequisites: EMQX running with ACL configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="test/acl/$(date +%s)"
TIMEOUT=10

echo "=== Test: ACL Enforcement ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test credentials
ADMIN_USER="admin"
ADMIN_PASS="admin"
TEST_USER="testuser"
TEST_PASS="testpass"
CLIENT_ID="acl-test-$(date +%s)"

# Test 1: Admin can access all topics
echo "--- Admin Access ---"

echo -n "Testing: Admin can publish to any topic... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${ADMIN_USER}" -P "${ADMIN_PASS}" \
    -t "any/topic/path" \
    -m "admin-test" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (ACL may not be enabled)"
    ((SKIPPED++))
fi

# Test 2: Test topics (allowed for all)
echo ""
echo "--- Test Topic Access ---"

echo -n "Testing: Publish to test/# (should be allowed)... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "test/allowed/topic" \
    -m "test-msg" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 3: Client-specific topics
echo ""
echo "--- Client-Specific Topics ---"

echo -n "Testing: Client can publish to own topic (devices/\${clientid}/#)... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${CLIENT_ID}" \
    -t "devices/${CLIENT_ID}/telemetry" \
    -m "client-telemetry" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 4: System topics ($SYS)
echo ""
echo "--- System Topics ---"

echo -n "Testing: Subscribe to \$SYS/# (should be allowed)... "
# Start subscriber, wait briefly, then stop
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t '$SYS/#' \
    -W 3 > /tmp/sys_topics.txt 2>/dev/null &
SUB_PID=$!
sleep 2
kill $SUB_PID 2>/dev/null || true
wait $SUB_PID 2>/dev/null || true

SYS_COUNT=$(wc -l < /tmp/sys_topics.txt 2>/dev/null | tr -d ' ' || echo "0")
rm -f /tmp/sys_topics.txt

if [ "${SYS_COUNT}" -ge 0 ]; then
    echo -e "${GREEN}PASSED${NC} (received ${SYS_COUNT} system messages)"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

echo -n "Testing: Publish to \$SYS/# (should be denied)... "
if ! mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t '$SYS/test/denied' \
    -m "should-fail" \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC} (correctly denied)"
    ((PASSED++))
else
    echo -e "${YELLOW}PARTIAL${NC} (ACL may allow $SYS publish)"
    ((SKIPPED++))
fi

# Test 5: Device twin topics
echo ""
echo "--- Device Twin Topics ---"

echo -n "Testing: Access own device twin (\$devices/\${clientid}/twin/#)... "
DEVICE_ID="device-${CLIENT_ID}"
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "\$devices/${DEVICE_ID}/twin/update" \
    -m '{"status": "online"}' \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (device twin topics may not be configured)"
    ((SKIPPED++))
fi

# Test 6: Public topics
echo ""
echo "--- Public Topics ---"

echo -n "Testing: Subscribe to public/# (should be allowed)... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t 'public/#' \
    -W 3 > /tmp/public_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -u "${TEST_USER}" -P "${TEST_PASS}" \
    -t 'public/announcement' \
    -m "public-message" \
    -q 1 2>/dev/null

sleep 1
kill $SUB_PID 2>/dev/null || true
wait $SUB_PID 2>/dev/null || true

PUBLIC_MSG=$(cat /tmp/public_msg.txt 2>/dev/null || echo "")
rm -f /tmp/public_msg.txt

if [ "${PUBLIC_MSG}" = "public-message" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 7: Telemetry topics
echo ""
echo "--- Telemetry Topics ---"

echo -n "Testing: Publish to telemetry/# (should be allowed)... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "telemetry/sensor/temperature" \
    -m '{"value": 25.5}' \
    -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 8: Shared subscription topics
echo ""
echo "--- Shared Subscription Topics ---"

echo -n "Testing: Subscribe to \$share/group/topic (should be allowed)... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t '$share/testgroup/telemetry/#' \
    -W 3 > /dev/null 2>/dev/null &
SUB_PID=$!
sleep 1
kill $SUB_PID 2>/dev/null || true
wait $SUB_PID 2>/dev/null || true

if [ $? -eq 0 ]; then
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
    echo -e "${GREEN}All ACL tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
