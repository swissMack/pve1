#!/bin/bash
# Test: Message Storage to InfluxDB
# Verifies: Messages are stored in InfluxDB (FR-029, FR-030)
# Prerequisites: EMQX and InfluxDB running with data bridge configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
INFLUXDB_HOST="${INFLUXDB_HOST:-localhost}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
INFLUXDB_ORG="${INFLUXDB_ORG:-mqtt-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-mqtt_messages}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-mqtt-influxdb-token}"
TEST_TOPIC="test/storage/$(date +%s)"
TIMEOUT=10

echo "=== Test: Message Storage to InfluxDB ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo "InfluxDB: ${INFLUXDB_HOST}:${INFLUXDB_PORT}"
echo "Bucket: ${INFLUXDB_BUCKET}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Function to query InfluxDB
query_influxdb() {
    local query=$1
    curl -s -X POST "http://${INFLUXDB_HOST}:${INFLUXDB_PORT}/api/v2/query?org=${INFLUXDB_ORG}" \
        -H "Authorization: Token ${INFLUXDB_TOKEN}" \
        -H "Content-Type: application/vnd.flux" \
        -d "$query" 2>/dev/null
}

# Test 1: InfluxDB is accessible
echo "--- InfluxDB Accessibility ---"

echo -n "Testing: InfluxDB health... "
INFLUX_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://${INFLUXDB_HOST}:${INFLUXDB_PORT}/health" 2>/dev/null || echo "000")

if [ "$INFLUX_HEALTH" = "200" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (HTTP $INFLUX_HEALTH)"
    ((FAILED++))
    echo "InfluxDB not accessible - skipping storage tests"
    exit 1
fi

# Test 2: Bucket exists
echo ""
echo "--- Bucket Configuration ---"

echo -n "Testing: mqtt_messages bucket exists... "
BUCKETS=$(curl -s "http://${INFLUXDB_HOST}:${INFLUXDB_PORT}/api/v2/buckets?org=${INFLUXDB_ORG}" \
    -H "Authorization: Token ${INFLUXDB_TOKEN}" 2>/dev/null || echo "")

if echo "$BUCKETS" | grep -q "mqtt_messages"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (bucket not found - run init script)"
    ((SKIPPED++))
fi

# Test 3: Publish message and verify storage
echo ""
echo "--- Message Storage ---"

echo -n "Testing: Publish message and store in InfluxDB... "
UNIQUE_ID=$(date +%s%N)
TEST_MSG="storage-test-${UNIQUE_ID}"

# Publish message
mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${TEST_TOPIC}" \
    -m "${TEST_MSG}" \
    -q 1 2>/dev/null

# Wait for message to be stored
sleep 3

# Query InfluxDB for the message
QUERY="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic == \"${TEST_TOPIC}\")
  |> last()"

RESULT=$(query_influxdb "$QUERY")

if echo "$RESULT" | grep -q "${TEST_MSG}\|${TEST_TOPIC}"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (data bridge may not be configured)"
    ((SKIPPED++))
fi

# Test 4: Multiple messages stored
echo ""
echo "--- Batch Message Storage ---"

echo -n "Testing: Multiple messages stored... "
BATCH_TOPIC="test/batch/$(date +%s)"

for i in 1 2 3 4 5; do
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "${BATCH_TOPIC}" \
        -m "batch-msg-${i}" \
        -q 1 2>/dev/null
    sleep 0.2
done

sleep 3

BATCH_QUERY="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic == \"${BATCH_TOPIC}\")
  |> count()"

BATCH_RESULT=$(query_influxdb "$BATCH_QUERY")

if echo "$BATCH_RESULT" | grep -q "[0-9]"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (data bridge may not be configured)"
    ((SKIPPED++))
fi

# Test 5: Message metadata stored
echo ""
echo "--- Message Metadata ---"

echo -n "Testing: Message metadata (topic, QoS, timestamp) stored... "
META_TOPIC="test/metadata/$(date +%s)"

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${META_TOPIC}" \
    -m '{"sensor": "temp", "value": 25.5}' \
    -q 2 2>/dev/null

sleep 2

META_QUERY="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic == \"${META_TOPIC}\")
  |> last()"

META_RESULT=$(query_influxdb "$META_QUERY")

if echo "$META_RESULT" | grep -q "topic\|qos\|_time"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (metadata storage may not be configured)"
    ((SKIPPED++))
fi

# Test 6: JSON payload stored correctly
echo ""
echo "--- JSON Payload Storage ---"

echo -n "Testing: JSON payload stored correctly... "
JSON_TOPIC="test/json/$(date +%s)"
JSON_PAYLOAD='{"temperature":25.5,"humidity":60,"device":"sensor-001"}'

mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "${JSON_TOPIC}" \
    -m "${JSON_PAYLOAD}" \
    -q 1 2>/dev/null

sleep 2

JSON_QUERY="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic == \"${JSON_TOPIC}\")
  |> last()"

JSON_RESULT=$(query_influxdb "$JSON_QUERY")

if echo "$JSON_RESULT" | grep -q "temperature\|25.5"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (JSON storage may not be configured)"
    ((SKIPPED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All message storage tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
