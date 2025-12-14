#!/bin/bash
# Wait for all MQTT Test Ecosystem services to be ready
# Usage: ./scripts/wait-for-services.sh [timeout_seconds]

set -e

TIMEOUT="${1:-120}"
INTERVAL=5
ELAPSED=0

echo "=== MQTT Test Ecosystem - Service Health Check ==="
echo "Timeout: ${TIMEOUT}s"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name is ready (HTTP $response)"
        return 0
    else
        echo -e "${YELLOW}○${NC} $name not ready (HTTP $response)"
        return 1
    fi
}

# Function to check EMQX via MQTT
check_emqx_mqtt() {
    if command -v mosquitto_pub &> /dev/null; then
        if mosquitto_pub -h localhost -p 1883 -t "test/health" -m "ping" -q 0 2>/dev/null; then
            echo -e "${GREEN}✓${NC} EMQX MQTT (port 1883) accepting connections"
            return 0
        fi
    else
        # Fallback to TCP check if mosquitto not available
        if nc -z localhost 1883 2>/dev/null; then
            echo -e "${GREEN}✓${NC} EMQX MQTT (port 1883) port open"
            return 0
        fi
    fi
    echo -e "${YELLOW}○${NC} EMQX MQTT not ready"
    return 1
}

# Main health check loop
check_all_services() {
    local all_ready=true

    echo "Checking services..."
    echo ""

    # EMQX Dashboard/API
    check_service "EMQX Dashboard" "http://localhost:18083/status" "200" || all_ready=false

    # EMQX MQTT
    check_emqx_mqtt || all_ready=false

    # InfluxDB
    check_service "InfluxDB" "http://localhost:8086/health" "200" || all_ready=false

    # Prometheus
    check_service "Prometheus" "http://localhost:9090/-/healthy" "200" || all_ready=false

    # Grafana
    check_service "Grafana" "http://localhost:3000/api/health" "200" || all_ready=false

    echo ""

    if $all_ready; then
        return 0
    else
        return 1
    fi
}

# Wait loop
while [ $ELAPSED -lt $TIMEOUT ]; do
    if check_all_services; then
        echo "=== All services are ready! ==="
        echo ""
        echo "Service URLs:"
        echo "  EMQX Dashboard: http://localhost:18083 (admin/public)"
        echo "  MQTT TCP:       mqtt://localhost:1883"
        echo "  MQTT TLS:       mqtts://localhost:8883"
        echo "  MQTT WS:        ws://localhost:8083/mqtt"
        echo "  MQTT WSS:       wss://localhost:8084/mqtt"
        echo "  InfluxDB:       http://localhost:8086"
        echo "  Prometheus:     http://localhost:9090"
        echo "  Grafana:        http://localhost:3000 (admin/admin)"
        echo ""
        exit 0
    fi

    echo "Waiting ${INTERVAL}s... (${ELAPSED}s/${TIMEOUT}s)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo -e "${RED}=== Timeout: Services did not become ready in ${TIMEOUT}s ===${NC}"
echo ""
echo "Troubleshooting:"
echo "  1. Check container status: docker compose ps"
echo "  2. Check container logs: docker compose logs [service]"
echo "  3. Verify Docker Desktop is running"
echo ""
exit 1
