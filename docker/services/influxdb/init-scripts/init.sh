#!/bin/bash
# InfluxDB Initialization Script
# Creates buckets and retention policies for MQTT message storage

set -e

echo "=== InfluxDB Initialization ==="
echo "Waiting for InfluxDB to be ready..."

# Wait for InfluxDB to be available
until influx ping &>/dev/null; do
    echo "Waiting for InfluxDB..."
    sleep 2
done

echo "InfluxDB is ready!"

# Configuration from environment
ORG="${DOCKER_INFLUXDB_INIT_ORG:-mqtt-org}"
TOKEN="${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN:-mqtt-influxdb-token}"
DEFAULT_RETENTION="${DOCKER_INFLUXDB_INIT_RETENTION:-24h}"

# Create additional buckets for different retention policies
echo "Creating retention policy buckets..."

# mqtt_messages_12h - 12 hour retention
influx bucket create \
    --name "mqtt_messages_12h" \
    --org "$ORG" \
    --retention 12h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket mqtt_messages_12h already exists"

# mqtt_messages_24h - 24 hour retention (default)
influx bucket create \
    --name "mqtt_messages_24h" \
    --org "$ORG" \
    --retention 24h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket mqtt_messages_24h already exists"

# mqtt_messages_48h - 48 hour retention
influx bucket create \
    --name "mqtt_messages_48h" \
    --org "$ORG" \
    --retention 48h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket mqtt_messages_48h already exists"

# mqtt_messages_7d - 7 day retention
influx bucket create \
    --name "mqtt_messages_7d" \
    --org "$ORG" \
    --retention 168h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket mqtt_messages_7d already exists"

# device_twins - Device twin state storage (indefinite retention)
influx bucket create \
    --name "device_twins" \
    --org "$ORG" \
    --retention 0 \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket device_twins already exists"

# dead_letter_queue - Failed message storage
influx bucket create \
    --name "dead_letter_queue" \
    --org "$ORG" \
    --retention 168h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket dead_letter_queue already exists"

# metrics - Broker metrics (longer retention)
influx bucket create \
    --name "mqtt_metrics" \
    --org "$ORG" \
    --retention 720h \
    --token "$TOKEN" \
    2>/dev/null || echo "Bucket mqtt_metrics already exists"

echo "Listing all buckets:"
influx bucket list --org "$ORG" --token "$TOKEN"

echo "=== InfluxDB Initialization Complete ==="
