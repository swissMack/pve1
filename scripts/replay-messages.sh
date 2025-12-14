#!/bin/bash
# Message Replay Script
# Replays historical messages from InfluxDB to MQTT
# Usage: ./scripts/replay-messages.sh [options]

set -e

# Configuration
BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
INFLUXDB_HOST="${INFLUXDB_HOST:-localhost}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
INFLUXDB_ORG="${INFLUXDB_ORG:-mqtt-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-mqtt_messages_24h}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-mqtt-influxdb-token}"

# Default options
START_TIME="-1h"
END_TIME="now()"
TOPIC_FILTER=""
DEST_TOPIC=""
DRY_RUN=false
DELAY_MS=100
QOS=1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage() {
    echo "Message Replay Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -s, --start TIME      Start time (default: -1h)"
    echo "                        Examples: -1h, -24h, -7d, 2024-01-01T00:00:00Z"
    echo "  -e, --end TIME        End time (default: now)"
    echo "  -t, --topic FILTER    Topic filter (regex)"
    echo "  -d, --dest TOPIC      Destination topic (default: original topic)"
    echo "  -b, --bucket NAME     InfluxDB bucket (default: mqtt_messages_24h)"
    echo "  -q, --qos LEVEL       QoS level for replay (default: 1)"
    echo "  --delay MS            Delay between messages in ms (default: 100)"
    echo "  --dry-run             Show messages without publishing"
    echo "  -h, --help            Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -s -1h -t 'telemetry/.*'"
    echo "  $0 -s -24h -e -12h -d replay/test"
    echo "  $0 -s 2024-01-01T00:00:00Z -t sensor/temperature --dry-run"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--start)
            START_TIME="$2"
            shift 2
            ;;
        -e|--end)
            END_TIME="$2"
            shift 2
            ;;
        -t|--topic)
            TOPIC_FILTER="$2"
            shift 2
            ;;
        -d|--dest)
            DEST_TOPIC="$2"
            shift 2
            ;;
        -b|--bucket)
            INFLUXDB_BUCKET="$2"
            shift 2
            ;;
        -q|--qos)
            QOS="$2"
            shift 2
            ;;
        --delay)
            DELAY_MS="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

echo "=== Message Replay ==="
echo "Source: InfluxDB ${INFLUXDB_HOST}:${INFLUXDB_PORT} (${INFLUXDB_BUCKET})"
echo "Destination: MQTT ${BROKER_HOST}:${BROKER_PORT}"
echo "Time range: ${START_TIME} to ${END_TIME}"
[ -n "$TOPIC_FILTER" ] && echo "Topic filter: ${TOPIC_FILTER}"
[ -n "$DEST_TOPIC" ] && echo "Destination topic: ${DEST_TOPIC}"
echo "Delay: ${DELAY_MS}ms between messages"
$DRY_RUN && echo -e "${YELLOW}DRY RUN - No messages will be published${NC}"
echo ""

# Build Flux query
QUERY="from(bucket: \"${INFLUXDB_BUCKET}\")
  |> range(start: ${START_TIME}, stop: ${END_TIME})
  |> filter(fn: (r) => r._measurement == \"mqtt_messages\")"

if [ -n "$TOPIC_FILTER" ]; then
    QUERY="${QUERY}
  |> filter(fn: (r) => r.topic =~ /${TOPIC_FILTER}/)"
fi

QUERY="${QUERY}
  |> sort(columns: [\"_time\"])
  |> limit(n: 10000)"

# Query InfluxDB
echo "Querying messages..."
RESULT=$(curl -s -X POST "http://${INFLUXDB_HOST}:${INFLUXDB_PORT}/api/v2/query?org=${INFLUXDB_ORG}" \
    -H "Authorization: Token ${INFLUXDB_TOKEN}" \
    -H "Content-Type: application/vnd.flux" \
    -H "Accept: application/csv" \
    -d "$QUERY" 2>/dev/null)

if [ -z "$RESULT" ]; then
    echo -e "${YELLOW}No messages found in specified time range${NC}"
    exit 0
fi

# Count messages
MSG_COUNT=$(echo "$RESULT" | grep -c "mqtt_messages" || echo "0")
echo "Found ${MSG_COUNT} messages to replay"
echo ""

if [ "$MSG_COUNT" -eq 0 ]; then
    exit 0
fi

# Parse and replay messages
echo "Replaying messages..."
REPLAYED=0
FAILED=0

# Process CSV output (simplified parsing)
echo "$RESULT" | while IFS=, read -r line; do
    # Skip header and empty lines
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^table ]] && continue
    [[ "$line" =~ ^_result ]] && continue

    # Extract topic and payload (positions may vary based on query)
    # This is a simplified parser - production would need robust CSV parsing
    TOPIC=$(echo "$line" | grep -o 'topic=[^,]*' | cut -d= -f2 || echo "")
    PAYLOAD=$(echo "$line" | grep -o 'payload=[^,]*' | cut -d= -f2 || echo "")

    if [ -n "$TOPIC" ] && [ -n "$PAYLOAD" ]; then
        # Determine destination topic
        if [ -n "$DEST_TOPIC" ]; then
            PUB_TOPIC="$DEST_TOPIC"
        else
            PUB_TOPIC="$TOPIC"
        fi

        if $DRY_RUN; then
            echo "[DRY RUN] Topic: $PUB_TOPIC, Payload: $PAYLOAD"
        else
            if mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} \
                -t "$PUB_TOPIC" \
                -m "$PAYLOAD" \
                -q ${QOS} 2>/dev/null; then
                ((REPLAYED++))
                echo -ne "\rReplayed: ${REPLAYED}"
            else
                ((FAILED++))
            fi

            # Delay between messages
            sleep $(echo "scale=3; ${DELAY_MS}/1000" | bc)
        fi
    fi
done

echo ""
echo ""
echo "=== Replay Complete ==="
echo -e "Replayed: ${GREEN}${REPLAYED}${NC}"
[ $FAILED -gt 0 ] && echo -e "Failed: ${RED}${FAILED}${NC}"
