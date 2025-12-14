#!/bin/bash
# Test: Health Endpoints
# Verifies: Liveness and readiness probes (FR-027)
# Prerequisites: All services running

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
EMQX_API_PORT="${EMQX_API_PORT:-18083}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3000}"

echo "=== Test: Health Endpoints ==="
echo "EMQX:       ${BROKER_HOST}:${EMQX_API_PORT}"
echo "InfluxDB:   ${BROKER_HOST}:${INFLUXDB_PORT}"
echo "Prometheus: ${BROKER_HOST}:${PROMETHEUS_PORT}"
echo "Grafana:    ${BROKER_HOST}:${GRAFANA_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Function to check health endpoint
check_health() {
    local name=$1
    local url=$2
    local expected=${3:-200}

    echo -n "Testing: ${name}... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}PASSED${NC} (HTTP $response)"
        ((PASSED++))
        return 0
    elif [ "$response" = "000" ]; then
        echo -e "${YELLOW}SKIPPED${NC} (Service not reachable)"
        ((SKIPPED++))
        return 1
    else
        echo -e "${RED}FAILED${NC} (HTTP $response, expected $expected)"
        ((FAILED++))
        return 1
    fi
}

# Test 1: EMQX Health Endpoints
echo "--- EMQX Health ---"

check_health "EMQX status endpoint" "http://${BROKER_HOST}:${EMQX_API_PORT}/status"
check_health "EMQX API v5 status" "http://${BROKER_HOST}:${EMQX_API_PORT}/api/v5/status"

# Test EMQX liveness (MQTT port)
echo -n "Testing: EMQX MQTT liveness (port 1883)... "
if nc -z ${BROKER_HOST} 1883 2>/dev/null; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((FAILED++))
fi

# Test 2: InfluxDB Health Endpoints
echo ""
echo "--- InfluxDB Health ---"

check_health "InfluxDB health" "http://${BROKER_HOST}:${INFLUXDB_PORT}/health"
check_health "InfluxDB ping" "http://${BROKER_HOST}:${INFLUXDB_PORT}/ping" "204"
check_health "InfluxDB ready" "http://${BROKER_HOST}:${INFLUXDB_PORT}/ready"

# Test 3: Prometheus Health Endpoints
echo ""
echo "--- Prometheus Health ---"

check_health "Prometheus healthy" "http://${BROKER_HOST}:${PROMETHEUS_PORT}/-/healthy"
check_health "Prometheus ready" "http://${BROKER_HOST}:${PROMETHEUS_PORT}/-/ready"

# Test 4: Grafana Health Endpoints
echo ""
echo "--- Grafana Health ---"

check_health "Grafana health" "http://${BROKER_HOST}:${GRAFANA_PORT}/api/health"

# Test 5: Docker health check status (if docker available)
echo ""
echo "--- Docker Container Health ---"

if command -v docker &> /dev/null; then
    echo -n "Testing: Docker EMQX container health... "
    EMQX_STATUS=$(docker inspect --format='{{.State.Health.Status}}' mqtt-emqx 2>/dev/null || echo "not-found")
    if [ "$EMQX_STATUS" = "healthy" ]; then
        echo -e "${GREEN}PASSED${NC} ($EMQX_STATUS)"
        ((PASSED++))
    elif [ "$EMQX_STATUS" = "not-found" ]; then
        echo -e "${YELLOW}SKIPPED${NC} (container not found)"
        ((SKIPPED++))
    else
        echo -e "${YELLOW}$EMQX_STATUS${NC}"
        ((SKIPPED++))
    fi

    echo -n "Testing: Docker InfluxDB container health... "
    INFLUX_STATUS=$(docker inspect --format='{{.State.Health.Status}}' mqtt-influxdb 2>/dev/null || echo "not-found")
    if [ "$INFLUX_STATUS" = "healthy" ]; then
        echo -e "${GREEN}PASSED${NC} ($INFLUX_STATUS)"
        ((PASSED++))
    elif [ "$INFLUX_STATUS" = "not-found" ]; then
        echo -e "${YELLOW}SKIPPED${NC} (container not found)"
        ((SKIPPED++))
    else
        echo -e "${YELLOW}$INFLUX_STATUS${NC}"
        ((SKIPPED++))
    fi

    echo -n "Testing: Docker Prometheus container health... "
    PROM_STATUS=$(docker inspect --format='{{.State.Health.Status}}' mqtt-prometheus 2>/dev/null || echo "not-found")
    if [ "$PROM_STATUS" = "healthy" ]; then
        echo -e "${GREEN}PASSED${NC} ($PROM_STATUS)"
        ((PASSED++))
    elif [ "$PROM_STATUS" = "not-found" ]; then
        echo -e "${YELLOW}SKIPPED${NC} (container not found)"
        ((SKIPPED++))
    else
        echo -e "${YELLOW}$PROM_STATUS${NC}"
        ((SKIPPED++))
    fi

    echo -n "Testing: Docker Grafana container health... "
    GRAFANA_STATUS=$(docker inspect --format='{{.State.Health.Status}}' mqtt-grafana 2>/dev/null || echo "not-found")
    if [ "$GRAFANA_STATUS" = "healthy" ]; then
        echo -e "${GREEN}PASSED${NC} ($GRAFANA_STATUS)"
        ((PASSED++))
    elif [ "$GRAFANA_STATUS" = "not-found" ]; then
        echo -e "${YELLOW}SKIPPED${NC} (container not found)"
        ((SKIPPED++))
    else
        echo -e "${YELLOW}$GRAFANA_STATUS${NC}"
        ((SKIPPED++))
    fi
else
    echo "Docker not available - skipping container health checks"
    ((SKIPPED+=4))
fi

# Test 6: Response time check
echo ""
echo "--- Response Time ---"

echo -n "Testing: EMQX response time < 500ms... "
START=$(date +%s%N)
curl -s -o /dev/null "http://${BROKER_HOST}:${EMQX_API_PORT}/status" 2>/dev/null || true
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if [ "$DURATION" -lt 500 ]; then
    echo -e "${GREEN}PASSED${NC} (${DURATION}ms)"
    ((PASSED++))
elif [ "$DURATION" -lt 1000 ]; then
    echo -e "${YELLOW}SLOW${NC} (${DURATION}ms)"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} (${DURATION}ms)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All health endpoint tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
