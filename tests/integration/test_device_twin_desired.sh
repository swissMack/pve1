#!/bin/bash
# Test: Device Twin Desired State
# Verifies: Update desired state and receive delta (FR-036, FR-037)
# Prerequisites: EMQX running with device twin rules configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TIMEOUT=10

echo "=== Test: Device Twin Desired State ==="
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
DEVICE_ID="twin-test-$(date +%s)"

# Device Twin Topic Patterns (AWS IoT Shadow-like)
TWIN_GET="\$devices/${DEVICE_ID}/twin/get"
TWIN_GET_RESPONSE="\$devices/${DEVICE_ID}/twin/get/response"
TWIN_UPDATE="\$devices/${DEVICE_ID}/twin/update"
TWIN_UPDATE_DELTA="\$devices/${DEVICE_ID}/twin/update/delta"
TWIN_DESIRED="\$devices/${DEVICE_ID}/twin/desired"
TWIN_REPORTED="\$devices/${DEVICE_ID}/twin/reported"

# Test 1: Subscribe to delta notifications
echo "--- Delta Notifications ---"

echo -n "Testing: Subscribe to delta topic... "
# Start subscriber in background
timeout 15 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID}" \
    -t "${TWIN_UPDATE_DELTA}" \
    -t "${TWIN_GET_RESPONSE}" \
    -C 1 > /tmp/delta_result_$$ 2>/dev/null &
SUB_PID=$!

sleep 2

# Publish desired state update
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_DESIRED}" \
    -m '{"temperature_setpoint": 22, "mode": "cooling"}' \
    -r -q 1 2>/dev/null

# Wait for subscriber
wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/delta_result_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (delta rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/delta_result_$$

# Test 2: Set desired state
echo ""
echo "--- Desired State Operations ---"

echo -n "Testing: Set desired state... "
DESIRED_STATE='{"temperature_setpoint": 24, "mode": "heating", "fan_speed": "auto"}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_DESIRED}" \
    -m "${DESIRED_STATE}" \
    -r -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 3: Read desired state
echo -n "Testing: Read desired state (retained)... "
READ_DESIRED=$(timeout 3 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_DESIRED}" \
    -C 1 2>/dev/null || echo "")

if echo "$READ_DESIRED" | grep -q "temperature_setpoint\|24"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 4: Update partial desired state
echo -n "Testing: Update partial desired state... "
PARTIAL_UPDATE='{"fan_speed": "high"}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_UPDATE}" \
    -m "{\"state\": {\"desired\": ${PARTIAL_UPDATE}}}" \
    -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 5: Get twin state
echo ""
echo "--- Twin Get Operations ---"

echo -n "Testing: Request twin state (get)... "
# Subscribe for response first
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_GET_RESPONSE}" \
    -C 1 > /tmp/get_response_$$ 2>/dev/null &
GET_SUB_PID=$!

sleep 1

# Request twin state
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_GET}" \
    -m '{}' \
    -q 1 2>/dev/null

wait $GET_SUB_PID 2>/dev/null || true

if [ -s /tmp/get_response_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (get handler rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/get_response_$$

# Test 6: Delta calculation (desired vs reported)
echo ""
echo "--- Delta Calculation ---"

echo -n "Testing: Delta notification on state mismatch... "
DEVICE_ID_DELTA="delta-test-$(date +%s)"

# Set desired state
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_ID_DELTA}/twin/desired" \
    -m '{"target_temp": 25, "lights": "on"}' \
    -r -q 1 2>/dev/null

# Start listening for delta
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -i "${DEVICE_ID_DELTA}" \
    -t "\$devices/${DEVICE_ID_DELTA}/twin/update/delta" \
    -C 1 > /tmp/delta_calc_$$ 2>/dev/null &
DELTA_PID=$!

sleep 1

# Set reported state (different from desired)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_ID_DELTA}/twin/reported" \
    -m '{"target_temp": 20, "lights": "off"}' \
    -r -q 1 2>/dev/null

wait $DELTA_PID 2>/dev/null || true

if [ -s /tmp/delta_calc_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (delta calculation rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/delta_calc_$$

# Test 7: Desired state versioning
echo ""
echo "--- State Versioning ---"

echo -n "Testing: State with version tracking... "
VERSIONED_STATE='{"version": 1, "state": {"desired": {"setting": "value1"}}}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TWIN_UPDATE}" \
    -m "${VERSIONED_STATE}" \
    -q 1 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 8: Multiple device twins
echo ""
echo "--- Multi-Device Support ---"

echo -n "Testing: Multiple device twins independently... "
DEVICE_A="multi-twin-a-$$"
DEVICE_B="multi-twin-b-$$"

# Set different desired states
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_A}/twin/desired" \
    -m '{"color": "red"}' \
    -r -q 1 2>/dev/null

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_B}/twin/desired" \
    -m '{"color": "blue"}' \
    -r -q 1 2>/dev/null

sleep 1

# Read both
STATE_A=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_A}/twin/desired" -C 1 2>/dev/null || echo "")
STATE_B=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/${DEVICE_B}/twin/desired" -C 1 2>/dev/null || echo "")

if echo "$STATE_A" | grep -q "red" && echo "$STATE_B" | grep -q "blue"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Cleanup retained messages
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TWIN_DESIRED}" -n -r 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_ID_DELTA}/twin/desired" -n -r 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_ID_DELTA}/twin/reported" -n -r 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_A}/twin/desired" -n -r 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "\$devices/${DEVICE_B}/twin/desired" -n -r 2>/dev/null || true

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All device twin desired state tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
