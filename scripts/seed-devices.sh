#!/bin/bash
# Seed Device Registry
# Initializes device registry with seed data from config/devices.json
# Creates retained messages for device twins and metadata

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
DEVICES_FILE="${DEVICES_FILE:-config/devices.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Device Registry Seeding ==="
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo "Devices file: ${DEVICES_FILE}"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if mosquitto_pub is installed
if ! command -v mosquitto_pub &> /dev/null; then
    echo -e "${RED}Error: mosquitto_pub is required but not installed${NC}"
    echo "Install with: brew install mosquitto (macOS) or apt-get install mosquitto-clients (Linux)"
    exit 1
fi

# Check if devices file exists
FULL_PATH="${PROJECT_ROOT}/${DEVICES_FILE}"
if [ ! -f "$FULL_PATH" ]; then
    echo -e "${RED}Error: Devices file not found: ${FULL_PATH}${NC}"
    exit 1
fi

# Test MQTT connection
echo -n "Testing MQTT connection... "
if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "test/ping" -m "ping" -q 0 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "Cannot connect to MQTT broker at ${BROKER_HOST}:${BROKER_PORT}"
    exit 1
fi

echo ""
echo "--- Seeding Devices ---"

# Count devices
DEVICE_COUNT=$(jq '.devices | length' "$FULL_PATH")
echo "Found ${DEVICE_COUNT} devices to seed"
echo ""

SEEDED=0
FAILED=0

# Iterate through devices
for i in $(seq 0 $((DEVICE_COUNT - 1))); do
    DEVICE=$(jq ".devices[$i]" "$FULL_PATH")
    DEVICE_ID=$(echo "$DEVICE" | jq -r '.device_id')
    DEVICE_NAME=$(echo "$DEVICE" | jq -r '.name')
    DEVICE_TYPE=$(echo "$DEVICE" | jq -r '.type')

    echo -n "Seeding device: ${DEVICE_ID} (${DEVICE_TYPE})... "

    # Extract twin states
    DESIRED=$(echo "$DEVICE" | jq -c '.twin.desired // {}')
    REPORTED=$(echo "$DEVICE" | jq -c '.twin.reported // {}')
    METADATA=$(echo "$DEVICE" | jq -c '{device_id: .device_id, type: .type, name: .name, location: .location, capabilities: .capabilities, firmware_version: .firmware_version, metadata: .metadata}')

    # Publish desired state (retained)
    if [ "$DESIRED" != "{}" ] && [ "$DESIRED" != "null" ]; then
        mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
            -t "\$devices/${DEVICE_ID}/twin/desired" \
            -m "$DESIRED" \
            -r -q 1 2>/dev/null || { echo -e "${RED}FAILED${NC}"; ((FAILED++)); continue; }
    fi

    # Publish reported state (retained)
    if [ "$REPORTED" != "{}" ] && [ "$REPORTED" != "null" ]; then
        mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
            -t "\$devices/${DEVICE_ID}/twin/reported" \
            -m "$REPORTED" \
            -r -q 1 2>/dev/null || { echo -e "${RED}FAILED${NC}"; ((FAILED++)); continue; }
    fi

    # Publish device metadata (retained)
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "\$devices/${DEVICE_ID}/metadata" \
        -m "$METADATA" \
        -r -q 1 2>/dev/null || { echo -e "${RED}FAILED${NC}"; ((FAILED++)); continue; }

    # Publish initial online status
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "\$devices/${DEVICE_ID}/status" \
        -m '{"status": "registered", "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' \
        -r -q 1 2>/dev/null || { echo -e "${RED}FAILED${NC}"; ((FAILED++)); continue; }

    echo -e "${GREEN}OK${NC}"
    ((SEEDED++))
done

# Seed device groups
echo ""
echo "--- Seeding Device Groups ---"

GROUP_COUNT=$(jq '.device_groups | length' "$FULL_PATH")
echo "Found ${GROUP_COUNT} device groups"

for i in $(seq 0 $((GROUP_COUNT - 1))); do
    GROUP=$(jq ".device_groups[$i]" "$FULL_PATH")
    GROUP_ID=$(echo "$GROUP" | jq -r '.group_id')
    GROUP_NAME=$(echo "$GROUP" | jq -r '.name')

    echo -n "Seeding group: ${GROUP_ID}... "

    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
        -t "\$groups/${GROUP_ID}/config" \
        -m "$GROUP" \
        -r -q 1 2>/dev/null && echo -e "${GREEN}OK${NC}" || echo -e "${YELLOW}SKIPPED${NC}"
done

# Summary
echo ""
echo "=== Seeding Summary ==="
echo -e "Devices seeded: ${GREEN}${SEEDED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"

# Verify seeding
echo ""
echo "--- Verification ---"

echo -n "Checking device metadata topics... "
METADATA_COUNT=$(timeout 3 mosquitto_sub -h ${BROKER_HOST} -p ${BROKER_PORT} \
    -t "\$devices/+/metadata" \
    -C ${DEVICE_COUNT} 2>/dev/null | wc -l || echo "0")

if [ "$METADATA_COUNT" -ge 1 ]; then
    echo -e "${GREEN}Found ${METADATA_COUNT} devices${NC}"
else
    echo -e "${YELLOW}No metadata found (may need more time)${NC}"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Device registry seeding complete!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some devices failed to seed${NC}"
    exit 1
fi
