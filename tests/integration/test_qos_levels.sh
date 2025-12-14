#!/bin/bash
# Test: QoS Level Delivery Semantics
# Verifies: QoS 0 (at most once), QoS 1 (at least once), QoS 2 (exactly once) (FR-003)
# Prerequisites: EMQX running on localhost:1883

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TEST_TOPIC="test/qos/$(date +%s)"
TIMEOUT=10

echo "=== Test: QoS Level Delivery Semantics ==="
echo "Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test QoS 0 - At most once (fire and forget)
echo "--- QoS 0: At Most Once ---"

echo -n "Testing: QoS 0 publish... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos0" -m "qos0-test" -q 0 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: QoS 0 subscribe receives message... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos0/receive" -q 0 -C 1 -W ${TIMEOUT} > /tmp/qos0_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos0/receive" -m "qos0-receive" -q 0
wait $SUB_PID 2>/dev/null || true
QOS0_MSG=$(cat /tmp/qos0_msg.txt 2>/dev/null || echo "")
rm -f /tmp/qos0_msg.txt

if [ "${QOS0_MSG}" = "qos0-receive" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test QoS 1 - At least once (acknowledged delivery)
echo ""
echo "--- QoS 1: At Least Once ---"

echo -n "Testing: QoS 1 publish (waits for PUBACK)... "
if timeout 5 mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos1" -m "qos1-test" -q 1 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (no PUBACK received)"
    ((FAILED++))
fi

echo -n "Testing: QoS 1 subscribe receives message... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos1/receive" -q 1 -C 1 -W ${TIMEOUT} > /tmp/qos1_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos1/receive" -m "qos1-receive" -q 1
wait $SUB_PID 2>/dev/null || true
QOS1_MSG=$(cat /tmp/qos1_msg.txt 2>/dev/null || echo "")
rm -f /tmp/qos1_msg.txt

if [ "${QOS1_MSG}" = "qos1-receive" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test QoS 2 - Exactly once (four-way handshake)
echo ""
echo "--- QoS 2: Exactly Once ---"

echo -n "Testing: QoS 2 publish (four-way handshake)... "
if timeout 10 mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos2" -m "qos2-test" -q 2 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (handshake incomplete)"
    ((FAILED++))
fi

echo -n "Testing: QoS 2 subscribe receives message... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos2/receive" -q 2 -C 1 -W ${TIMEOUT} > /tmp/qos2_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/qos2/receive" -m "qos2-receive" -q 2
wait $SUB_PID 2>/dev/null || true
QOS2_MSG=$(cat /tmp/qos2_msg.txt 2>/dev/null || echo "")
rm -f /tmp/qos2_msg.txt

if [ "${QOS2_MSG}" = "qos2-receive" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test QoS downgrade (subscriber QoS < publisher QoS)
echo ""
echo "--- QoS Downgrade ---"

echo -n "Testing: Publisher QoS 2, Subscriber QoS 1 (should receive at QoS 1)... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/downgrade" -q 1 -C 1 -W ${TIMEOUT} > /tmp/downgrade_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/downgrade" -m "downgrade-test" -q 2
wait $SUB_PID 2>/dev/null || true
DOWNGRADE_MSG=$(cat /tmp/downgrade_msg.txt 2>/dev/null || echo "")
rm -f /tmp/downgrade_msg.txt

if [ "${DOWNGRADE_MSG}" = "downgrade-test" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test multiple messages at different QoS levels
echo ""
echo "--- Multiple QoS Messages ---"

echo -n "Testing: Multiple messages at different QoS levels... "
mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/#" -q 2 -C 3 -W ${TIMEOUT} > /tmp/multi_msg.txt 2>/dev/null &
SUB_PID=$!
sleep 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/0" -m "msg0" -q 0
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/1" -m "msg1" -q 1
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "${TEST_TOPIC}/multi/2" -m "msg2" -q 2
wait $SUB_PID 2>/dev/null || true
MSG_COUNT=$(wc -l < /tmp/multi_msg.txt 2>/dev/null | tr -d ' ' || echo "0")
rm -f /tmp/multi_msg.txt

if [ "${MSG_COUNT}" -ge 3 ]; then
    echo -e "${GREEN}PASSED${NC} (received ${MSG_COUNT} messages)"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (received ${MSG_COUNT}/3 messages)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All QoS tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some QoS tests failed!${NC}"
    exit 1
fi
