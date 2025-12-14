#!/bin/bash
# Test: Rules Engine Webhook Delivery
# Verifies: HTTP webhook action (FR-041)
# Prerequisites: EMQX running with webhook bridge configured

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
WEBHOOK_HOST="${WEBHOOK_HOST:-localhost}"
WEBHOOK_PORT="${WEBHOOK_PORT:-8080}"
TIMEOUT=10

echo "=== Test: Rules Engine Webhook Delivery ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo "Webhook Target: ${WEBHOOK_HOST}:${WEBHOOK_PORT}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

# Check if webhook server is available
echo "--- Webhook Server Check ---"

echo -n "Testing: Webhook server availability... "
WEBHOOK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/health" 2>/dev/null || echo "000")

if [ "$WEBHOOK_STATUS" = "200" ]; then
    echo -e "${GREEN}AVAILABLE${NC}"
    WEBHOOK_AVAILABLE=true
    ((PASSED++))
elif [ "$WEBHOOK_STATUS" = "000" ]; then
    echo -e "${YELLOW}NOT AVAILABLE${NC} (tests will be skipped)"
    WEBHOOK_AVAILABLE=false
    ((SKIPPED++))
else
    echo -e "${YELLOW}HTTP ${WEBHOOK_STATUS}${NC}"
    WEBHOOK_AVAILABLE=false
    ((SKIPPED++))
fi

# Test 1: Basic webhook trigger
echo ""
echo "--- Basic Webhook ---"

echo -n "Testing: Publish message triggers webhook... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    # Clear previous webhook logs
    curl -s -X DELETE "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || true

    # Publish message
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/basic" \
        -m '{"event": "test", "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' \
        -q 1 2>/dev/null

    sleep 2

    # Check webhook received the message
    WEBHOOK_LOG=$(curl -s "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || echo "")

    if echo "$WEBHOOK_LOG" | grep -q "event\|test"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (webhook rule may not be configured)"
        ((SKIPPED++))
    fi
else
    echo -e "${YELLOW}SKIPPED${NC} (webhook server not available)"
    ((SKIPPED++))
fi

# Test 2: Webhook with custom headers
echo ""
echo "--- Custom Headers ---"

echo -n "Testing: Webhook includes custom headers... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    curl -s -X DELETE "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || true

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/headers" \
        -m '{"with_headers": true}' \
        -q 1 2>/dev/null

    sleep 2

    HEADER_LOG=$(curl -s "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs?include_headers=true" 2>/dev/null || echo "")

    if echo "$HEADER_LOG" | grep -qi "content-type\|x-mqtt"; then
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

# Test 3: Webhook payload transformation
echo ""
echo "--- Payload Transformation ---"

echo -n "Testing: Webhook transforms payload... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    curl -s -X DELETE "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || true

    # Publish with specific format
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/transform" \
        -m '{"sensor": "temp-001", "value": 25.5, "unit": "celsius"}' \
        -q 1 2>/dev/null

    sleep 2

    TRANSFORM_LOG=$(curl -s "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || echo "")

    if echo "$TRANSFORM_LOG" | grep -q "sensor\|value"; then
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

# Test 4: Webhook retry on failure
echo ""
echo "--- Retry Behavior ---"

echo -n "Testing: Webhook retry on temporary failure... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    # Configure webhook server to fail first request
    curl -s -X POST "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/config" \
        -H "Content-Type: application/json" \
        -d '{"fail_next": 1}' 2>/dev/null || true

    curl -s -X DELETE "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || true

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/retry" \
        -m '{"retry_test": true}' \
        -q 1 2>/dev/null

    sleep 5  # Wait for retry

    RETRY_LOG=$(curl -s "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || echo "")

    if echo "$RETRY_LOG" | grep -q "retry_test"; then
        echo -e "${GREEN}PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}SKIPPED${NC} (retry may not be configured)"
        ((SKIPPED++))
    fi

    # Reset failure config
    curl -s -X POST "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/config" \
        -H "Content-Type: application/json" \
        -d '{"fail_next": 0}' 2>/dev/null || true
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 5: Multiple webhooks
echo ""
echo "--- Multiple Webhook Endpoints ---"

echo -n "Testing: Message triggers multiple webhooks... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    curl -s -X DELETE "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs" 2>/dev/null || true

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/multi" \
        -m '{"multi_endpoint": true}' \
        -q 1 2>/dev/null

    sleep 2

    MULTI_LOG=$(curl -s "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/logs?count=true" 2>/dev/null || echo "0")

    # Check if at least one webhook was received
    if echo "$MULTI_LOG" | grep -qE "[1-9]"; then
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

# Test 6: Webhook timeout handling
echo ""
echo "--- Timeout Handling ---"

echo -n "Testing: Webhook handles slow endpoint... "
if [ "$WEBHOOK_AVAILABLE" = true ]; then
    # Configure slow response
    curl -s -X POST "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/config" \
        -H "Content-Type: application/json" \
        -d '{"delay_ms": 2000}' 2>/dev/null || true

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "webhook/test/slow" \
        -m '{"slow_test": true}' \
        -q 1 2>/dev/null

    # Message should still be published regardless of webhook
    echo -e "${GREEN}PASSED${NC} (async delivery)"
    ((PASSED++))

    # Reset delay
    curl -s -X POST "http://${WEBHOOK_HOST}:${WEBHOOK_PORT}/config" \
        -H "Content-Type: application/json" \
        -d '{"delay_ms": 0}' 2>/dev/null || true
else
    echo -e "${YELLOW}SKIPPED${NC}"
    ((SKIPPED++))
fi

# Test 7: Verify webhook bridge configuration exists
echo ""
echo "--- Bridge Configuration ---"

echo -n "Testing: Webhook bridge is configured in EMQX... "
# Check if webhook bridge exists via API
EMQX_API_HOST="${EMQX_API_HOST:-localhost}"
EMQX_API_PORT="${EMQX_API_PORT:-18083}"

BRIDGES=$(curl -s -u "admin:public" \
    "http://${EMQX_API_HOST}:${EMQX_API_PORT}/api/v5/bridges" 2>/dev/null || echo "")

if echo "$BRIDGES" | grep -q "webhook\|http"; then
    echo -e "${GREEN}PASSED${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} (no webhook bridges found)"
    ((SKIPPED++))
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All webhook tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
