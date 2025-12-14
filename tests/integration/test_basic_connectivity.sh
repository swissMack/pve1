#!/bin/bash
# Test: Basic MQTT Connectivity
# Verifies: Connect, publish, subscribe on port 1883 (FR-001, FR-010)
# Prerequisites: EMQX running on localhost:1883

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../fixtures/test-helpers.sh" 2>/dev/null || true

# Test configuration
BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="test/basic/connectivity/$(date +%s)"
TEST_MESSAGE="Hello MQTT $(date +%s)"
TIMEOUT=10

echo "=== Test: Basic MQTT Connectivity ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo "Topic: ${TEST_TOPIC}"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

# Function to run a test
run_test() {
    local name=$1
    local cmd=$2

    echo -n "Testing: ${name}... "
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# Test 1: TCP connection to broker
run_test "TCP Connection" "nc -z ${BROKER_HOST} ${BROKER_PORT}"

# Test 2: MQTT CONNECT with clean session
run_test "MQTT CONNECT (clean session)" \
    "mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t '${TEST_TOPIC}' -m 'connect-test' -q 0"

# Test 3: MQTT CONNECT with client ID
run_test "MQTT CONNECT (with client ID)" \
    "mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -i 'test-client-$(date +%s)' -t '${TEST_TOPIC}' -m 'client-id-test' -q 0"

# Test 4: Publish QoS 0
run_test "Publish QoS 0" \
    "mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t '${TEST_TOPIC}/qos0' -m 'qos0-message' -q 0"

# Test 5: Publish QoS 1
run_test "Publish QoS 1" \
    "mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t '${TEST_TOPIC}/qos1' -m 'qos1-message' -q 1"

# Test 6: Publish QoS 2
run_test "Publish QoS 2" \
    "mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t '${TEST_TOPIC}/qos2' -m 'qos2-message' -q 2"

# Test 7: Subscribe and receive message
echo -n "Testing: Publish/Subscribe round-trip... "
RECEIVED_MSG=""

# Start subscriber in background
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/roundtrip" -C 1 -W ${TIMEOUT} > /tmp/mqtt_test_msg.txt 2>/dev/null &
SUB_PID=$!

# Give subscriber time to connect
sleep 1

# Publish message
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/roundtrip" -m "${TEST_MESSAGE}" -q 1

# Wait for subscriber
wait $SUB_PID 2>/dev/null || true

RECEIVED_MSG=$(cat /tmp/mqtt_test_msg.txt 2>/dev/null || echo "")
rm -f /tmp/mqtt_test_msg.txt

if [ "${RECEIVED_MSG}" = "${TEST_MESSAGE}" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (expected: '${TEST_MESSAGE}', got: '${RECEIVED_MSG}')"
    ((FAILED++))
fi

# Test 8: Wildcard subscription (+)
echo -n "Testing: Wildcard subscription (+)... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/+/wild" -C 1 -W ${TIMEOUT} > /tmp/mqtt_wild_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/level1/wild" -m "wildcard-plus" -q 1
wait $SUB_PID 2>/dev/null || true
WILD_MSG=$(cat /tmp/mqtt_wild_msg.txt 2>/dev/null || echo "")
rm -f /tmp/mqtt_wild_msg.txt

if [ "${WILD_MSG}" = "wildcard-plus" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 9: Wildcard subscription (#)
echo -n "Testing: Wildcard subscription (#)... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/#" -C 1 -W ${TIMEOUT} > /tmp/mqtt_multi_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/level/deep" -m "wildcard-hash" -q 1
wait $SUB_PID 2>/dev/null || true
MULTI_MSG=$(cat /tmp/mqtt_multi_msg.txt 2>/dev/null || echo "")
rm -f /tmp/mqtt_multi_msg.txt

if [ "${MULTI_MSG}" = "wildcard-hash" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
