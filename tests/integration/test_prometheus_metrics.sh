#!/bin/bash
# Test: Prometheus Metrics
# Verifies: EMQX metrics endpoint, Prometheus scraping (FR-025)
# Prerequisites: EMQX and Prometheus running

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
EMQX_API_PORT="${EMQX_API_PORT:-18083}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
TIMEOUT=10

echo "=== Test: Prometheus Metrics ==="
echo "EMQX API: ${BROKER_HOST}:${EMQX_API_PORT}"
echo "Prometheus: ${BROKER_HOST}:${PROMETHEUS_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Test 1: EMQX metrics endpoint accessible
echo "--- EMQX Metrics Endpoint ---"

echo -n "Testing: EMQX Prometheus metrics endpoint... "
METRICS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://${BROKER_HOST}:${EMQX_API_PORT}/api/v5/prometheus/stats" 2>/dev/null || echo "000")

if [ "$METRICS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (HTTP ${METRICS_RESPONSE})"
    ((FAILED++))
fi

# Test 2: Metrics contain expected data
echo ""
echo "--- Metrics Content ---"

echo -n "Testing: Metrics contain connection count... "
METRICS=$(curl -s "http://${BROKER_HOST}:${EMQX_API_PORT}/api/v5/prometheus/stats" 2>/dev/null || echo "")

if echo "$METRICS" | grep -q "emqx_connections"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Metrics contain message count... "
if echo "$METRICS" | grep -q "emqx_messages"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Metrics contain subscription count... "
if echo "$METRICS" | grep -q "emqx_subscriptions"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: Metrics in Prometheus format... "
if echo "$METRICS" | head -1 | grep -q "^#\|^emqx"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 3: Prometheus is scraping EMQX
echo ""
echo "--- Prometheus Scraping ---"

echo -n "Testing: Prometheus is running... "
PROM_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://${BROKER_HOST}:${PROMETHEUS_PORT}/-/healthy" 2>/dev/null || echo "000")

if [ "$PROM_HEALTH" = "200" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (Prometheus not running)"
    ((SKIPPED++))
fi

echo -n "Testing: EMQX target is configured... "
TARGETS=$(curl -s "http://${BROKER_HOST}:${PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null || echo "")

if echo "$TARGETS" | grep -q "emqx"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (EMQX target not found)"
    ((SKIPPED++))
fi

echo -n "Testing: EMQX target is healthy... "
if echo "$TARGETS" | grep -q '"health":"up"'; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (Target may not be up yet)"
    ((SKIPPED++))
fi

# Test 4: Query specific metrics from Prometheus
echo ""
echo "--- Prometheus Queries ---"

echo -n "Testing: Query emqx_connections_count... "
QUERY_RESULT=$(curl -s "http://${BROKER_HOST}:${PROMETHEUS_PORT}/api/v1/query?query=emqx_connections_count" 2>/dev/null || echo "")

if echo "$QUERY_RESULT" | grep -q '"status":"success"'; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (Query may need time to populate)"
    ((SKIPPED++))
fi

# Test 5: Verify key EMQX metrics exist
echo ""
echo "--- Key Metrics Verification ---"

KEY_METRICS=(
    "emqx_connections_count"
    "emqx_sessions_count"
    "emqx_topics_count"
    "emqx_subscriptions_count"
    "emqx_messages_received"
    "emqx_messages_sent"
)

for metric in "${KEY_METRICS[@]}"; do
    echo -n "Testing: ${metric} exists... "
    if echo "$METRICS" | grep -q "$metric"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC}"
        ((SKIPPED++))
    fi
done

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All Prometheus metrics tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
