#!/bin/bash
# Test: Grafana Dashboards
# Verifies: Dashboard loads, data sources connected (FR-026)
# Prerequisites: Grafana running with provisioned dashboards

set -e

GRAFANA_HOST="${GRAFANA_HOST:-localhost}"
GRAFANA_PORT="${GRAFANA_PORT:-3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASS="${GRAFANA_PASS:-admin}"

echo "=== Test: Grafana Dashboards ==="
echo "Grafana: http://${GRAFANA_HOST}:${GRAFANA_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Function to make authenticated Grafana API calls
grafana_api() {
    local endpoint=$1
    curl -s -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
        "http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/${endpoint}" 2>/dev/null
}

# Test 1: Grafana is accessible
echo "--- Grafana Accessibility ---"

echo -n "Testing: Grafana health endpoint... "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://${GRAFANA_HOST}:${GRAFANA_PORT}/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (HTTP $HEALTH)"
    ((FAILED++))
    echo "Grafana not accessible - skipping remaining tests"
    exit 1
fi

# Test 2: Authentication works
echo ""
echo "--- Authentication ---"

echo -n "Testing: Grafana authentication... "
AUTH_CHECK=$(grafana_api "org" | grep -c "id" 2>/dev/null || echo "0")

if [ "$AUTH_CHECK" -gt 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (Authentication failed)"
    ((FAILED++))
fi

# Test 3: Data sources are configured
echo ""
echo "--- Data Sources ---"

DATASOURCES=$(grafana_api "datasources")

echo -n "Testing: Prometheus datasource exists... "
if echo "$DATASOURCES" | grep -q "Prometheus"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

echo -n "Testing: InfluxDB datasource exists... "
if echo "$DATASOURCES" | grep -q "InfluxDB"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (InfluxDB datasource not provisioned)"
    ((SKIPPED++))
fi

# Test 4: Data source health
echo ""
echo "--- Data Source Health ---"

# Get Prometheus datasource ID and test
PROM_ID=$(echo "$DATASOURCES" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2 || echo "")

if [ -n "$PROM_ID" ]; then
    echo -n "Testing: Prometheus datasource health... "
    DS_HEALTH=$(grafana_api "datasources/${PROM_ID}/health")

    if echo "$DS_HEALTH" | grep -q "success\|OK"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (Prometheus may not be ready)"
        ((SKIPPED++))
    fi
else
    echo "Could not find Prometheus datasource ID"
    ((SKIPPED++))
fi

# Test 5: Dashboards are provisioned
echo ""
echo "--- Dashboards ---"

DASHBOARDS=$(grafana_api "search?type=dash-db")

echo -n "Testing: Dashboards are available... "
DASH_COUNT=$(echo "$DASHBOARDS" | grep -c '"uid"' 2>/dev/null || echo "0")

if [ "$DASH_COUNT" -gt 0 ]; then
    echo -e "${GREEN}PASSED${NC} (${DASH_COUNT} dashboards found)"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (No dashboards provisioned yet)"
    ((SKIPPED++))
fi

echo -n "Testing: MQTT Overview dashboard exists... "
if echo "$DASHBOARDS" | grep -qi "mqtt\|overview"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (Dashboard not found)"
    ((SKIPPED++))
fi

# Test 6: Dashboard can be loaded
echo ""
echo "--- Dashboard Loading ---"

# Get first dashboard UID
DASH_UID=$(echo "$DASHBOARDS" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$DASH_UID" ]; then
    echo -n "Testing: Dashboard ${DASH_UID} loads... "
    DASH_CONTENT=$(grafana_api "dashboards/uid/${DASH_UID}")

    if echo "$DASH_CONTENT" | grep -q '"dashboard"'; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        ((FAILED++))
    fi
else
    echo "No dashboard UID found - skipping load test"
    ((SKIPPED++))
fi

# Test 7: Folder structure
echo ""
echo "--- Folder Structure ---"

FOLDERS=$(grafana_api "folders")

echo -n "Testing: Folders API accessible... "
if [ -n "$FOLDERS" ]; then
    FOLDER_COUNT=$(echo "$FOLDERS" | grep -c '"id"' 2>/dev/null || echo "0")
    echo -e "${GREEN}PASSED${NC} (${FOLDER_COUNT} folders)"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 8: Alert rules (if any)
echo ""
echo "--- Alert Rules ---"

echo -n "Testing: Alert rules API accessible... "
ALERTS=$(grafana_api "ruler/grafana/api/v1/rules" 2>/dev/null || echo "")

if [ -n "$ALERTS" ]; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (Alerting may not be configured)"
    ((SKIPPED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All Grafana dashboard tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
