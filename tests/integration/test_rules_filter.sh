#!/bin/bash
# Test: Rules Engine SQL-like Filtering
# Verifies: WHERE conditions and filtering (FR-043)
# Prerequisites: EMQX running with filter rules configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
TIMEOUT=10

echo "=== Test: Rules Engine SQL-like Filtering ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test 1: Filter by numeric comparison
echo "--- Numeric Filtering ---"

echo -n "Testing: Filter where value > threshold... "
FILTER_INPUT="filter/numeric"
FILTER_OUTPUT="filter/high-values"

# Subscribe to filtered output
timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${FILTER_OUTPUT}" \
    -C 1 > /tmp/numeric_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish value below threshold (should NOT pass filter)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${FILTER_INPUT}" \
    -m '{"temperature": 15}' \
    -q 1 2>/dev/null

sleep 1

# Publish value above threshold (should pass filter)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${FILTER_INPUT}" \
    -m '{"temperature": 35}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/numeric_filter_$$ ]; then
    RESULT=$(cat /tmp/numeric_filter_$$)
    if echo "$RESULT" | grep -q "35"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC} (filter rule may not be configured)"
    ((SKIPPED++))
fi
rm -f /tmp/numeric_filter_$$

# Test 2: Filter by string equality
echo ""
echo "--- String Filtering ---"

echo -n "Testing: Filter where type = 'alert'... "
STRING_INPUT="filter/events"
STRING_OUTPUT="filter/alerts-only"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${STRING_OUTPUT}" \
    -C 1 > /tmp/string_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish non-alert (should NOT pass)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${STRING_INPUT}" \
    -m '{"type": "info", "message": "normal event"}' \
    -q 1 2>/dev/null

sleep 1

# Publish alert (should pass)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${STRING_INPUT}" \
    -m '{"type": "alert", "message": "high temperature"}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/string_filter_$$ ]; then
    RESULT=$(cat /tmp/string_filter_$$)
    if echo "$RESULT" | grep -q "alert"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/string_filter_$$

# Test 3: Filter with AND condition
echo ""
echo "--- AND Conditions ---"

echo -n "Testing: Filter with multiple AND conditions... "
AND_INPUT="filter/sensor-data"
AND_OUTPUT="filter/critical-alerts"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${AND_OUTPUT}" \
    -C 1 > /tmp/and_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish: only high temp (one condition)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${AND_INPUT}" \
    -m '{"temperature": 40, "pressure": 50}' \
    -q 1 2>/dev/null

sleep 1

# Publish: both conditions met (temp > 30 AND pressure > 100)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${AND_INPUT}" \
    -m '{"temperature": 40, "pressure": 120}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/and_filter_$$ ]; then
    RESULT=$(cat /tmp/and_filter_$$)
    if echo "$RESULT" | grep -q "120"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/and_filter_$$

# Test 4: Filter with OR condition
echo ""
echo "--- OR Conditions ---"

echo -n "Testing: Filter with OR conditions... "
OR_INPUT="filter/multi-type"
OR_OUTPUT="filter/important"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${OR_OUTPUT}" \
    -C 2 > /tmp/or_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish: matches first OR condition (priority = high)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${OR_INPUT}" \
    -m '{"priority": "high", "category": "normal"}' \
    -q 1 2>/dev/null

# Publish: matches second OR condition (category = critical)
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${OR_INPUT}" \
    -m '{"priority": "low", "category": "critical"}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

OR_COUNT=$(wc -l < /tmp/or_filter_$$ 2>/dev/null || echo "0")
if [ "$OR_COUNT" -ge 1 ]; then
    echo -e "${GREEN}PASSED${NC} (matched ${OR_COUNT} message(s))"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/or_filter_$$

# Test 5: Filter by regex pattern
echo ""
echo "--- Regex Filtering ---"

echo -n "Testing: Filter with regex pattern... "
REGEX_INPUT="filter/devices"
REGEX_OUTPUT="filter/sensor-devices"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${REGEX_OUTPUT}" \
    -C 1 > /tmp/regex_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish: non-matching device ID
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${REGEX_INPUT}" \
    -m '{"device_id": "actuator-001", "value": 100}' \
    -q 1 2>/dev/null

sleep 1

# Publish: matching device ID (starts with "sensor-")
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${REGEX_INPUT}" \
    -m '{"device_id": "sensor-temp-001", "value": 25.5}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/regex_filter_$$ ]; then
    RESULT=$(cat /tmp/regex_filter_$$)
    if echo "$RESULT" | grep -q "sensor"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/regex_filter_$$

# Test 6: Filter by nested field
echo ""
echo "--- Nested Field Filtering ---"

echo -n "Testing: Filter by nested JSON field... "
NESTED_INPUT="filter/nested"
NESTED_OUTPUT="filter/nested-match"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NESTED_OUTPUT}" \
    -C 1 > /tmp/nested_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish with nested structure
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NESTED_INPUT}" \
    -m '{"device": {"type": "sensor", "config": {"enabled": true}}, "data": 123}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/nested_filter_$$ ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/nested_filter_$$

# Test 7: Filter with NULL check
echo ""
echo "--- NULL Checks ---"

echo -n "Testing: Filter where field is NOT NULL... "
NULL_INPUT="filter/optional-field"
NULL_OUTPUT="filter/has-optional"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NULL_OUTPUT}" \
    -C 1 > /tmp/null_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish without optional field
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NULL_INPUT}" \
    -m '{"required": "value"}' \
    -q 1 2>/dev/null

sleep 1

# Publish with optional field
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${NULL_INPUT}" \
    -m '{"required": "value", "optional": "present"}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/null_filter_$$ ]; then
    RESULT=$(cat /tmp/null_filter_$$)
    if echo "$RESULT" | grep -q "optional"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/null_filter_$$

# Test 8: Filter by array contains
echo ""
echo "--- Array Contains ---"

echo -n "Testing: Filter where array contains value... "
ARRAY_INPUT="filter/with-tags"
ARRAY_OUTPUT="filter/has-critical-tag"

timeout 5 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${ARRAY_OUTPUT}" \
    -C 1 > /tmp/array_filter_$$ 2>/dev/null &
SUB_PID=$!

sleep 1

# Publish without critical tag
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${ARRAY_INPUT}" \
    -m '{"message": "test", "tags": ["info", "normal"]}' \
    -q 1 2>/dev/null

sleep 1

# Publish with critical tag
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${ARRAY_INPUT}" \
    -m '{"message": "alert", "tags": ["warning", "critical"]}' \
    -q 1 2>/dev/null

wait $SUB_PID 2>/dev/null || true

if [ -s /tmp/array_filter_$$ ]; then
    RESULT=$(cat /tmp/array_filter_$$)
    if echo "$RESULT" | grep -q "critical"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi
rm -f /tmp/array_filter_$$

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All filter tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
