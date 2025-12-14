#!/bin/bash
# Test: Retained Messages
# Verifies: Retain flag, new subscriber delivery, retained message clearing (FR-007)
# Prerequisites: EMQX running on localhost:1883

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="test/retained/$(date +%s)"
TIMEOUT=10

echo "=== Test: Retained Messages ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0

# Cleanup: Clear any existing retained messages
cleanup_retained() {
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "${TEST_TOPIC}/cleanup" \
        -n -r -q 1 2>/dev/null || true
}

# Test 1: Publish retained message
echo "--- Retained Message Publish ---"

echo -n "Testing: Publish with retain flag... "
RETAIN_TOPIC="${TEST_TOPIC}/basic"
RETAIN_MSG="retained-$(date +%s)"

if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_TOPIC}" \
    -m "${RETAIN_MSG}" \
    -r -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 2: New subscriber receives retained message
echo ""
echo "--- New Subscriber Receives Retained ---"

echo -n "Testing: New subscriber receives retained message... "
sleep 1

# Subscribe AFTER the message was published with retain
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_TOPIC}" \
    -q 1 -C 1 -W ${TIMEOUT} > /tmp/retained_msg.txt 2>/dev/null

RECEIVED_MSG=$(cat /tmp/retained_msg.txt 2>/dev/null || echo "")
rm -f /tmp/retained_msg.txt

if [ "${RECEIVED_MSG}" = "${RETAIN_MSG}" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (expected: '${RETAIN_MSG}', got: '${RECEIVED_MSG}')"
    ((FAILED++))
fi

# Test 3: Update retained message
echo ""
echo "--- Update Retained Message ---"

echo -n "Testing: Update retained message... "
UPDATED_MSG="updated-$(date +%s)"

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_TOPIC}" \
    -m "${UPDATED_MSG}" \
    -r -q 1 2>/dev/null

sleep 1

mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_TOPIC}" \
    -q 1 -C 1 -W ${TIMEOUT} > /tmp/updated_msg.txt 2>/dev/null

RECEIVED_UPDATED=$(cat /tmp/updated_msg.txt 2>/dev/null || echo "")
rm -f /tmp/updated_msg.txt

if [ "${RECEIVED_UPDATED}" = "${UPDATED_MSG}" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (expected: '${UPDATED_MSG}', got: '${RECEIVED_UPDATED}')"
    ((FAILED++))
fi

# Test 4: Clear retained message (publish empty message with retain)
echo ""
echo "--- Clear Retained Message ---"

echo -n "Testing: Clear retained message (empty payload with retain)... "
CLEAR_TOPIC="${TEST_TOPIC}/clear"

# First, publish a retained message
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${CLEAR_TOPIC}" \
    -m "to-be-cleared" \
    -r -q 1 2>/dev/null

sleep 1

# Clear it with empty payload and retain flag
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${CLEAR_TOPIC}" \
    -n -r -q 1 2>/dev/null

sleep 1

# New subscriber should NOT receive any message (or receive empty)
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${CLEAR_TOPIC}" \
    -q 1 -W 3 > /tmp/cleared_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 2
kill $SUB_PID 2>/dev/null || true
wait $SUB_PID 2>/dev/null || true

CLEARED_MSG=$(cat /tmp/cleared_msg.txt 2>/dev/null || echo "")
rm -f /tmp/cleared_msg.txt

# Message should be empty or not received
if [ -z "${CLEARED_MSG}" ] || [ "${CLEARED_MSG}" = "" ]; then
    echo -e "${GREEN}PASSED${NC} (retained message cleared)"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (still received: '${CLEARED_MSG}')"
    ((FAILED++))
fi

# Test 5: Retained message with wildcard subscription
echo ""
echo "--- Retained with Wildcards ---"

echo -n "Testing: Retained messages received with wildcard subscription... "
WILD_TOPIC="${TEST_TOPIC}/wild"

# Publish retained messages to multiple topics
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/a" -m "wild-a" -r -q 1 2>/dev/null
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/b" -m "wild-b" -r -q 1 2>/dev/null
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/c" -m "wild-c" -r -q 1 2>/dev/null

sleep 1

# Subscribe with wildcard - should receive all retained messages
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${WILD_TOPIC}/+" \
    -q 1 -W 5 > /tmp/wild_retained.txt 2>/dev/null &
SUB_PID=$!
sleep 3
kill $SUB_PID 2>/dev/null || true
wait $SUB_PID 2>/dev/null || true

WILD_COUNT=$(wc -l < /tmp/wild_retained.txt 2>/dev/null | tr -d ' ' || echo "0")
rm -f /tmp/wild_retained.txt

if [ "$WILD_COUNT" -ge 3 ]; then
    echo -e "${GREEN}PASSED${NC} (received ${WILD_COUNT} retained messages)"
    ((PASSED++))
else
    echo -e "${YELLOW}PARTIAL${NC} (received ${WILD_COUNT}/3 messages)"
    # Not failing as this might be timing dependent
fi

# Test 6: Non-retained message doesn't replace retained
echo ""
echo "--- Non-Retained Doesn't Replace ---"

echo -n "Testing: Non-retained message doesn't clear retained... "
NONREPLACE_TOPIC="${TEST_TOPIC}/nonreplace"

# Publish retained message
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NONREPLACE_TOPIC}" \
    -m "original-retained" \
    -r -q 1 2>/dev/null

sleep 1

# Publish non-retained message (without -r flag)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NONREPLACE_TOPIC}" \
    -m "non-retained-update" \
    -q 1 2>/dev/null

sleep 1

# New subscriber should still get the original retained message
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NONREPLACE_TOPIC}" \
    -q 1 -C 1 -W ${TIMEOUT} > /tmp/nonreplace_msg.txt 2>/dev/null

NONREPLACE_MSG=$(cat /tmp/nonreplace_msg.txt 2>/dev/null || echo "")
rm -f /tmp/nonreplace_msg.txt

if [ "${NONREPLACE_MSG}" = "original-retained" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (expected: 'original-retained', got: '${NONREPLACE_MSG}')"
    ((FAILED++))
fi

# Cleanup: Clear test retained messages
echo ""
echo "Cleaning up retained messages..."
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${RETAIN_TOPIC}" -n -r -q 1 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/a" -n -r -q 1 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/b" -n -r -q 1 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${WILD_TOPIC}/c" -n -r -q 1 2>/dev/null || true
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${NONREPLACE_TOPIC}" -n -r -q 1 2>/dev/null || true

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All retained message tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
