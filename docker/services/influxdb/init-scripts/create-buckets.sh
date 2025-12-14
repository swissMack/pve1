#!/bin/bash
# InfluxDB Bucket Creation Script
# Creates buckets with different retention policies for MQTT messages

set -e

echo "=== InfluxDB Bucket Creation ==="

# Configuration from environment
ORG="${DOCKER_INFLUXDB_INIT_ORG:-mqtt-org}"
TOKEN="${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN:-mqtt-influxdb-token}"

# Wait for InfluxDB to be ready
echo "Waiting for InfluxDB..."
until influx ping &>/dev/null; do
    sleep 2
done
echo "InfluxDB is ready!"

# Function to create bucket if not exists
create_bucket() {
    local name=$1
    local retention=$2
    local description=$3

    echo -n "Creating bucket '${name}' (retention: ${retention})... "

    if influx bucket list --org "$ORG" --token "$TOKEN" 2>/dev/null | grep -q "^${name}"; then
        echo "already exists"
    else
        influx bucket create \
            --name "$name" \
            --org "$ORG" \
            --retention "$retention" \
            --token "$TOKEN" \
            --description "$description" \
            2>/dev/null && echo "created" || echo "failed"
    fi
}

# Create retention policy buckets (FR-030)
echo ""
echo "--- Message History Buckets ---"
create_bucket "mqtt_messages_12h" "12h" "Short-term message history (12 hours)"
create_bucket "mqtt_messages_24h" "24h" "Default message history (24 hours)"
create_bucket "mqtt_messages_48h" "48h" "Extended message history (48 hours)"
create_bucket "mqtt_messages_7d" "168h" "Long-term message history (7 days)"

# Create special purpose buckets
echo ""
echo "--- Special Purpose Buckets ---"
create_bucket "device_twins" "0" "Device twin state (no expiry)"
create_bucket "dead_letter_queue" "168h" "Undeliverable messages (7 days)"
create_bucket "mqtt_metrics" "720h" "Broker metrics (30 days)"
create_bucket "telemetry" "24h" "Device telemetry data (24 hours)"

# List all buckets
echo ""
echo "=== Created Buckets ==="
influx bucket list --org "$ORG" --token "$TOKEN" 2>/dev/null | head -20

echo ""
echo "=== Bucket Creation Complete ==="
