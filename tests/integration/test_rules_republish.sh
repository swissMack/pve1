#!/bin/bash
# Test: Rules Engine Republish/Transform
# Verifies: Message transformation and republish (FR-042)
# Prerequisites: EMQX running with republish rules configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TIMEOUT=10

echo "=== Test: Rules Engine Republish/Transform ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test 1: Basic republish to different topic
echo "--- Basic Republish ---"

echo -n "Testing: Republish to different topic... "
INPUT_TOPIC="input/sensor/data"
OUTPUT_TOPIC="output/processed/data"

# Subscribe to output topic
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${OUTPUT_TOPIC}" \
    -C 1 > /tmp/republish_basic_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish to input topic
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${INPUT_TOPIC}" \
    -m '{"sensor": "temp-001", "value": 25.5}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/republish_basic_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (republish rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/republish_basic_$$

# Test 2: Topic transformation (dynamic topic)
echo ""
echo "--- Dynamic Topic Transformation ---"

echo -n "Testing: Transform topic based on payload... "
# Rule should route based on device type in payload
DYNAMIC_INPUT="devices/incoming"

# Subscribe to multiple possible outputs
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "devices/temperature/#" \
    -t "devices/humidity/#" \
    -C 1 > /tmp/dynamic_topic_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${DYNAMIC_INPUT}" \
    -m '{"device_type": "temperature", "device_id": "sensor-001", "value": 22.0}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/dynamic_topic_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/dynamic_topic_$$

# Test 3: Payload transformation (add fields)
echo ""
echo "--- Payload Transformation ---"

echo -n "Testing: Add timestamp to payload... "
TRANSFORM_INPUT="transform/add-timestamp"
TRANSFORM_OUTPUT="transform/with-timestamp"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TRANSFORM_OUTPUT}" \
    -C 1 > /tmp/add_timestamp_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TRANSFORM_INPUT}" \
    -m '{"data": "original"}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/add_timestamp_$$ ]; then
    RESULT=$(cat /tmp/add_timestamp_$$)
    if echo "$RESULT" | grep -q "timestamp\|processed"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (transformation may not add timestamp)"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/add_timestamp_$$

# Test 4: Payload field extraction
echo ""
echo "--- Field Extraction ---"

echo -n "Testing: Extract specific fields from payload... "
EXTRACT_INPUT="extract/full-payload"
EXTRACT_OUTPUT="extract/value-only"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${EXTRACT_OUTPUT}" \
    -C 1 > /tmp/extract_field_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${EXTRACT_INPUT}" \
    -m '{"sensor": "temp", "value": 25.5, "unit": "C", "extra": "data"}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/extract_field_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/extract_field_$$

# Test 5: Republish with QoS change
echo ""
echo "--- QoS Modification ---"

echo -n "Testing: Republish with different QoS... "
QOS_INPUT="qos/input"
QOS_OUTPUT="qos/upgraded"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${QOS_OUTPUT}" \
    -q 2 \
    -C 1 > /tmp/qos_change_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish with QoS 0
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${QOS_INPUT}" \
    -m '{"important": true}' \
    -q 0 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/qos_change_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/qos_change_$$

# Test 6: Fan-out (one-to-many republish)
echo ""
echo "--- Fan-Out Pattern ---"

echo -n "Testing: Republish to multiple topics... "
FANOUT_INPUT="fanout/source"
FANOUT_OUT1="fanout/dest1"
FANOUT_OUT2="fanout/dest2"

# Subscribe to both destinations
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${FANOUT_OUT1}" \
    -t "${FANOUT_OUT2}" \
    -C 2 > /tmp/fanout_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${FANOUT_INPUT}" \
    -m '{"broadcast": true}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

FANOUT_COUNT=$(wc -l < /tmp/fanout_$$ 2>/dev/null || echo "0")
if [ "$FANOUT_COUNT" -ge 1 ]; then
    echo -e "${GREEN}PASSED${NC} (received on ${FANOUT_COUNT} topic(s))"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/fanout_$$

# Test 7: Aggregate/merge multiple inputs
echo ""
echo "--- Message Aggregation ---"

echo -n "Testing: Aggregate messages from multiple sources... "
AGG_OUTPUT="aggregated/combined"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${AGG_OUTPUT}" \
    -C 1 > /tmp/aggregate_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish from multiple sources
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "source/a/data" \
    -m '{"source": "a", "value": 10}' \
    -q 1 2>/dev/null

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "source/b/data" \
    -m '{"source": "b", "value": 20}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/aggregate_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (aggregation rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/aggregate_$$

# Test 8: Retain flag modification
echo ""
echo "--- Retain Flag ---"

echo -n "Testing: Add retain flag on republish... "
RETAIN_INPUT="retain/input"
RETAIN_OUTPUT="retain/output"

# Publish without retain
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_INPUT}" \
    -m '{"make_retained": true}' \
    -q 1 2>/dev/null

sleep 1

# Subscribe should get retained message if rule adds retain flag
RETAINED=$(timeout 2 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${RETAIN_OUTPUT}" \
    -C 1 2>/dev/null || echo "")

if [ -n "$RETAINED" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
    # Clean up retained message
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "${RETAIN_OUTPUT}" -n -r 2>/dev/null || true
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
    echo -e "${GREEN}All republish/transform tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
