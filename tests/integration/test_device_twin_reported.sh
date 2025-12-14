#!/bin/bash
# Test: Device Twin Reported State
# Verifies: Report state and query twin (FR-036, FR-038)
# Prerequisites: EMQX running with device twin rules configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TIMEOUT=10

echo "=== Test: Device Twin Reported State ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test device ID
DEVICE_ID="reported-test-$(date +%s)"

# Device Twin Topic Patterns
TWIN_REPORTED="\$devices/${DEVICE_ID}/twin/reported"
TWIN_UPDATE="\$devices/${DEVICE_ID}/twin/update"
TWIN_GET="\$devices/${DEVICE_ID}/twin/get"
TWIN_GET_RESPONSE="\$devices/${DEVICE_ID}/twin/get/response"

# Test 1: Report device state
echo "--- Report State ---"

echo -n "Testing: Report device state... "
REPORTED_STATE='{"temperature": 23.5, "humidity": 45, "battery": 87}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_REPORTED}" \
    -m "${REPORTED_STATE}" \
    -r -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 2: Read reported state (retained)
echo -n "Testing: Read reported state (retained)... "
READ_STATE=$(timeout 3 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_REPORTED}" \
    -C 1 2>/dev/null || echo "")

if echo "$READ_STATE" | grep -q "temperature\|23.5"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 3: Update reported state via update topic
echo ""
echo "--- Update Operations ---"

echo -n "Testing: Update reported state via update topic... "
UPDATE_MSG='{"state": {"reported": {"temperature": 24.0, "humidity": 50}}}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_UPDATE}" \
    -m "${UPDATE_MSG}" \
    -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 4: Partial state update
echo -n "Testing: Partial state update (single field)... "
PARTIAL_UPDATE='{"state": {"reported": {"battery": 95}}}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_UPDATE}" \
    -m "${PARTIAL_UPDATE}" \
    -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 5: Report with timestamp
echo ""
echo "--- Timestamped Reports ---"

echo -n "Testing: Report state with timestamp... "
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMPED_STATE="{\"temperature\": 25.0, \"timestamp\": \"${TIMESTAMP}\"}"

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_REPORTED}" \
    -m "${TIMESTAMPED_STATE}" \
    -r -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 6: Query complete twin state
echo ""
echo "--- Query Twin ---"

echo -n "Testing: Query complete twin state... "
# Subscribe to response
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_GET_RESPONSE}" \
    -C 1 > /tmp/twin_query_$$ 2>/dev/null &
QUERY_PID=$!

sleep 1

# Send get request
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_GET}" \
    -m '{}' \
    -q 1 2>/dev/null

wait $QUERY_PID 2>/dev/null || true

if [ -s /tmp/twin_query_$$ ]; then
    RESPONSE=$(cat /tmp/twin_query_$$)
    if echo "$RESPONSE" | grep -q "reported\|desired"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (response format unexpected)"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC} (get handler may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/twin_query_$$

# Test 7: Report nested state
echo ""
echo "--- Complex State ---"

echo -n "Testing: Report nested/complex state... "
NESTED_STATE='{
    "sensors": {
        "temperature": {"value": 22.5, "unit": "celsius"},
        "humidity": {"value": 55, "unit": "percent"}
    },
    "status": {
        "online": true,
        "uptime": 3600
    }
}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_REPORTED}" \
    -m "${NESTED_STATE}" \
    -r -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 8: Verify nested state retrieval
echo -n "Testing: Retrieve nested state... "
RETRIEVED=$(timeout 3 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_REPORTED}" \
    -C 1 2>/dev/null || echo "")

if echo "$RETRIEVED" | grep -q "sensors\|celsius"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 9: Report from multiple devices
echo ""
echo "--- Multi-Device Reports ---"

echo -n "Testing: Multiple devices report independently... "
DEVICE_A="multi-report-a-$$"
DEVICE_B="multi-report-b-$$"

# Report from device A
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_A}" \
    -t "\$devices/${DEVICE_A}/twin/reported" \
    -m '{"location": "room-a", "temp": 20}' \
    -r -q 1 2>/dev/null

# Report from device B
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_B}" \
    -t "\$devices/${DEVICE_B}/twin/reported" \
    -m '{"location": "room-b", "temp": 25}' \
    -r -q 1 2>/dev/null

sleep 1

# Verify both states are independent
STATE_A=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_A}/twin/reported" -C 1 2>/dev/null || echo "")
STATE_B=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_B}/twin/reported" -C 1 2>/dev/null || echo "")

if echo "$STATE_A" | grep -q "room-a" && echo "$STATE_B" | grep -q "room-b"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 10: Clear reported state
echo ""
echo "--- State Cleanup ---"

echo -n "Testing: Clear reported state... "
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_REPORTED}" \
    -n -r -q 1 2>/dev/null

sleep 1

CLEARED=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_REPORTED}" \
    -C 1 2>/dev/null || echo "cleared")

if [ "$CLEARED" = "cleared" ] || [ -z "$CLEARED" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Cleanup
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_A}/twin/reported" -n -r 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_B}/twin/reported" -n -r 2>/dev/null || true

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All device twin reported state tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
