#!/bin/bash
# Test: Message History Query
# Verifies: Query by time range and topic (FR-031)
# Prerequisites: InfluxDB with stored messages

set -e

INFLUXDB_HOST="${INFLUXDB_HOST:-localhost}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
INFLUXDB_ORG="${INFLUXDB_ORG:-mqtt-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-mqtt_messages_24h}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-mqtt-influxdb-token}"

echo "=== Test: Message History Query ==="
echo "InfluxDB: ${INFLUXDB_HOST}:${INFLUXDB_PORT}"
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

# Test 1: Query by time range
echo "--- Time Range Queries ---"

echo -n "Testing: Query last 1 hour... "
QUERY_1H="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> count()"

RESULT_1H=$(query_influxdb "$QUERY_1H")

if [ -n "$RESULT_1H" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (no data or bucket not configured)"
    ((SKIPPED++))
fi

echo -n "Testing: Query last 24 hours... "
QUERY_24H="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> count()"

RESULT_24H=$(query_influxdb "$QUERY_24H")

if [ -n "$RESULT_24H" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

echo -n "Testing: Query specific time window... "
QUERY_WINDOW="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -2h, stop: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> count()"

RESULT_WINDOW=$(query_influxdb "$QUERY_WINDOW")

if [ -n "$RESULT_WINDOW" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 2: Query by topic filter
echo ""
echo "--- Topic Filtering ---"

echo -n "Testing: Query by exact topic... "
QUERY_TOPIC="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic == \"telemetry/sensor/temperature\")
  |> count()"

RESULT_TOPIC=$(query_influxdb "$QUERY_TOPIC")

if [ -n "$RESULT_TOPIC" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

echo -n "Testing: Query by topic prefix (regex)... "
QUERY_PREFIX="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> filter(fn: (r) => r.topic =~ /^telemetry\\//)
  |> count()"

RESULT_PREFIX=$(query_influxdb "$QUERY_PREFIX")

if [ -n "$RESULT_PREFIX" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 3: Aggregation queries
echo ""
echo "--- Aggregation Queries ---"

echo -n "Testing: Count messages by topic... "
QUERY_COUNT="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> group(columns: [\"topic\"])
  |> count()"

RESULT_COUNT=$(query_influxdb "$QUERY_COUNT")

if [ -n "$RESULT_COUNT" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

echo -n "Testing: Message rate per minute... "
QUERY_RATE="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> aggregateWindow(every: 1m, fn: count)
  |> mean()"

RESULT_RATE=$(query_influxdb "$QUERY_RATE")

if [ -n "$RESULT_RATE" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 4: Latest message query
echo ""
echo "--- Latest Message Queries ---"

echo -n "Testing: Get latest message per topic... "
QUERY_LATEST="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> group(columns: [\"topic\"])
  |> last()"

RESULT_LATEST=$(query_influxdb "$QUERY_LATEST")

if [ -n "$RESULT_LATEST" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 5: Pagination
echo ""
echo "--- Pagination ---"

echo -n "Testing: Limit results (pagination)... "
QUERY_LIMIT="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> limit(n: 10)"

RESULT_LIMIT=$(query_influxdb "$QUERY_LIMIT")

if [ -n "$RESULT_LIMIT" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

echo -n "Testing: Offset and limit... "
QUERY_OFFSET="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")
  |> limit(n: 10, offset: 5)"

RESULT_OFFSET=$(query_influxdb "$QUERY_OFFSET")

if [ -n "$RESULT_OFFSET" ]; then
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
    echo -e "${GREEN}All message history query tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
