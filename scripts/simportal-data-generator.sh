#!/bin/bash
# SIM Card Portal Data Generator
# Generates realistic IoT telemetry data for the SIM Card Portal
# Publishes sensor and location data to MQTT broker

set -e

BROKER_HOST="${MQTT_HOST:-localhost}"
BROKER_PORT="${MQTT_PORT:-1883}"
DEVICES_FILE="${DEVICES_FILE:-config/simportal-devices.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SENSOR_INTERVAL="${SENSOR_INTERVAL:-10}"
LOCATION_INTERVAL="${LOCATION_INTERVAL:-5}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== SIM Card Portal Data Generator ===${NC}"
echo "MQTT Broker: ${BROKER_HOST}:${BROKER_PORT}"
echo "Devices file: ${DEVICES_FILE}"
echo "Sensor interval: ${SENSOR_INTERVAL}s"
echo "Location interval: ${LOCATION_INTERVAL}s"
echo ""

# Check dependencies
for cmd in jq mosquitto_pub bc; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Error: $cmd is required but not installed${NC}"
        exit 1
    fi
done

# Check devices file
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

# Get topic prefix
TOPIC_PREFIX=$(jq -r '.topic_prefix // "simportal/devices"' "$FULL_PATH")
DEVICE_COUNT=$(jq '.devices | length' "$FULL_PATH")

echo "Topic prefix: ${TOPIC_PREFIX}"
echo "Devices to simulate: ${DEVICE_COUNT}"
echo ""

# Store device state
declare -A DEVICE_TEMP
declare -A DEVICE_HUMIDITY
declare -A DEVICE_LIGHT
declare -A DEVICE_BATTERY
declare -A DEVICE_LAT
declare -A DEVICE_LON
declare -A DEVICE_HEADING
declare -A DEVICE_SPEED

# Generate random float between min and max
random_float() {
    local min=$1
    local max=$2
    echo "scale=2; $min + ($RANDOM / 32767) * ($max - $min)" | bc
}

# Generate random int between min and max
random_int() {
    local min=$1
    local max=$2
    echo $(( min + RANDOM % (max - min + 1) ))
}

# Vary a value slightly (realistic sensor drift)
vary_value() {
    local current=$1
    local min=$2
    local max=$3
    local drift=$4

    local change=$(echo "scale=2; ($RANDOM / 32767 - 0.5) * $drift" | bc)
    local new_val=$(echo "scale=2; $current + $change" | bc)

    # Clamp to bounds
    if (( $(echo "$new_val < $min" | bc -l) )); then
        new_val=$min
    elif (( $(echo "$new_val > $max" | bc -l) )); then
        new_val=$max
    fi

    echo $new_val
}

# Initialize device states
init_devices() {
    echo -e "${YELLOW}Initializing device states...${NC}"

    for i in $(seq 0 $((DEVICE_COUNT - 1))); do
        local device=$(jq ".devices[$i]" "$FULL_PATH")
        local device_id=$(echo "$device" | jq -r '.device_id')

        # Initialize sensors
        local temp_min=$(echo "$device" | jq -r '.sensor_ranges.temperature.min')
        local temp_max=$(echo "$device" | jq -r '.sensor_ranges.temperature.max')
        local hum_min=$(echo "$device" | jq -r '.sensor_ranges.humidity.min')
        local hum_max=$(echo "$device" | jq -r '.sensor_ranges.humidity.max')
        local light_min=$(echo "$device" | jq -r '.sensor_ranges.light.min')
        local light_max=$(echo "$device" | jq -r '.sensor_ranges.light.max')
        local bat_min=$(echo "$device" | jq -r '.sensor_ranges.battery.min')
        local bat_max=$(echo "$device" | jq -r '.sensor_ranges.battery.max')

        DEVICE_TEMP[$device_id]=$(random_float $temp_min $temp_max)
        DEVICE_HUMIDITY[$device_id]=$(random_float $hum_min $hum_max)
        DEVICE_LIGHT[$device_id]=$(random_int $light_min $light_max)
        DEVICE_BATTERY[$device_id]=$(random_int $bat_min $bat_max)

        # Initialize location for mobile devices
        local has_location=$(echo "$device" | jq -r '.has_location')
        if [ "$has_location" = "true" ]; then
            local center_lat=$(echo "$device" | jq -r '.location_mobile.center_latitude')
            local center_lon=$(echo "$device" | jq -r '.location_mobile.center_longitude')
            DEVICE_LAT[$device_id]=$center_lat
            DEVICE_LON[$device_id]=$center_lon
            DEVICE_HEADING[$device_id]=$(random_int 0 359)
            DEVICE_SPEED[$device_id]=$(random_float 0 60)
        else
            # Static location
            local static_lat=$(echo "$device" | jq -r '.location_static.latitude')
            local static_lon=$(echo "$device" | jq -r '.location_static.longitude')
            DEVICE_LAT[$device_id]=$static_lat
            DEVICE_LON[$device_id]=$static_lon
        fi

        echo "  ${device_id}: temp=${DEVICE_TEMP[$device_id]}C, hum=${DEVICE_HUMIDITY[$device_id]}%, bat=${DEVICE_BATTERY[$device_id]}%"
    done
    echo ""
}

# Publish sensor data for a device
publish_sensors() {
    local device_id=$1
    local device=$2

    local temp_min=$(echo "$device" | jq -r '.sensor_ranges.temperature.min')
    local temp_max=$(echo "$device" | jq -r '.sensor_ranges.temperature.max')
    local hum_min=$(echo "$device" | jq -r '.sensor_ranges.humidity.min')
    local hum_max=$(echo "$device" | jq -r '.sensor_ranges.humidity.max')
    local light_min=$(echo "$device" | jq -r '.sensor_ranges.light.min')
    local light_max=$(echo "$device" | jq -r '.sensor_ranges.light.max')

    # Vary values realistically
    DEVICE_TEMP[$device_id]=$(vary_value ${DEVICE_TEMP[$device_id]} $temp_min $temp_max 0.5)
    DEVICE_HUMIDITY[$device_id]=$(vary_value ${DEVICE_HUMIDITY[$device_id]} $hum_min $hum_max 2)
    DEVICE_LIGHT[$device_id]=$(vary_value ${DEVICE_LIGHT[$device_id]} $light_min $light_max 50)

    # Battery drains slowly
    local current_bat=${DEVICE_BATTERY[$device_id]}
    if (( current_bat > 20 )); then
        DEVICE_BATTERY[$device_id]=$(( current_bat - (RANDOM % 2) ))
    fi

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    local signal_strength=$(random_int 50 100)

    local payload=$(cat <<EOF
{
  "timestamp": "${timestamp}",
  "deviceId": "${device_id}",
  "sensors": {
    "temperature": ${DEVICE_TEMP[$device_id]},
    "humidity": ${DEVICE_HUMIDITY[$device_id]},
    "light": ${DEVICE_LIGHT[$device_id]},
    "batteryLevel": ${DEVICE_BATTERY[$device_id]}
  },
  "metadata": {
    "signalStrength": ${signal_strength}
  }
}
EOF
)

    local topic="${TOPIC_PREFIX}/${device_id}/sensors"
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "$topic" -m "$payload" -q 1 2>/dev/null

    echo -e "  ${GREEN}[SENSOR]${NC} ${device_id}: temp=${DEVICE_TEMP[$device_id]}C, hum=${DEVICE_HUMIDITY[$device_id]}%, bat=${DEVICE_BATTERY[$device_id]}%"
}

# Publish location data for a mobile device
publish_location() {
    local device_id=$1
    local device=$2

    local has_location=$(echo "$device" | jq -r '.has_location')
    if [ "$has_location" != "true" ]; then
        return
    fi

    local center_lat=$(echo "$device" | jq -r '.location_mobile.center_latitude')
    local center_lon=$(echo "$device" | jq -r '.location_mobile.center_longitude')
    local radius_km=$(echo "$device" | jq -r '.location_mobile.radius_km')
    local speed_max=$(echo "$device" | jq -r '.location_mobile.speed_range.max')

    # Update heading occasionally
    if (( RANDOM % 5 == 0 )); then
        local heading_change=$(( (RANDOM % 60) - 30 ))
        DEVICE_HEADING[$device_id]=$(( (${DEVICE_HEADING[$device_id]} + heading_change + 360) % 360 ))
    fi

    # Vary speed
    DEVICE_SPEED[$device_id]=$(vary_value ${DEVICE_SPEED[$device_id]} 0 $speed_max 10)

    # Move based on heading and speed (simplified)
    local heading=${DEVICE_HEADING[$device_id]}
    local speed=${DEVICE_SPEED[$device_id]}
    local heading_rad=$(echo "scale=6; $heading * 3.14159 / 180" | bc)

    # Convert speed (km/h) to lat/lon change (very simplified)
    local lat_change=$(echo "scale=6; ($speed / 3600) * 0.009 * c($heading_rad)" | bc -l 2>/dev/null || echo "0")
    local lon_change=$(echo "scale=6; ($speed / 3600) * 0.009 * s($heading_rad)" | bc -l 2>/dev/null || echo "0")

    local new_lat=$(echo "scale=6; ${DEVICE_LAT[$device_id]} + $lat_change" | bc)
    local new_lon=$(echo "scale=6; ${DEVICE_LON[$device_id]} + $lon_change" | bc)

    # Keep within radius of center
    local dist_lat=$(echo "scale=6; ($new_lat - $center_lat) * 111" | bc)
    local dist_lon=$(echo "scale=6; ($new_lon - $center_lon) * 85" | bc)
    local dist=$(echo "scale=2; sqrt($dist_lat * $dist_lat + $dist_lon * $dist_lon)" | bc)

    if (( $(echo "$dist > $radius_km" | bc -l) )); then
        # Bounce back toward center
        DEVICE_HEADING[$device_id]=$(( (${DEVICE_HEADING[$device_id]} + 180) % 360 ))
    else
        DEVICE_LAT[$device_id]=$new_lat
        DEVICE_LON[$device_id]=$new_lon
    fi

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    local altitude=$(random_float 300 500)

    local payload=$(cat <<EOF
{
  "timestamp": "${timestamp}",
  "deviceId": "${device_id}",
  "location": {
    "latitude": ${DEVICE_LAT[$device_id]},
    "longitude": ${DEVICE_LON[$device_id]},
    "altitude": ${altitude},
    "speed": ${DEVICE_SPEED[$device_id]},
    "heading": ${DEVICE_HEADING[$device_id]}
  },
  "source": "gps"
}
EOF
)

    local topic="${TOPIC_PREFIX}/${device_id}/location"
    mosquitto_pub -h ${BROKER_HOST} -p ${BROKER_PORT} -t "$topic" -m "$payload" -q 1 2>/dev/null

    echo -e "  ${CYAN}[LOCATION]${NC} ${device_id}: lat=${DEVICE_LAT[$device_id]}, lon=${DEVICE_LON[$device_id]}, speed=${DEVICE_SPEED[$device_id]}km/h"
}

# Main generation loop
run_generator() {
    echo -e "${GREEN}Starting data generation (Ctrl+C to stop)${NC}"
    echo ""

    local sensor_counter=0
    local location_counter=0

    while true; do
        local now=$(date +"%H:%M:%S")

        # Publish sensors at sensor interval
        if (( sensor_counter % SENSOR_INTERVAL == 0 )); then
            echo -e "${YELLOW}[$now] Publishing sensor data...${NC}"
            for i in $(seq 0 $((DEVICE_COUNT - 1))); do
                local device=$(jq ".devices[$i]" "$FULL_PATH")
                local device_id=$(echo "$device" | jq -r '.device_id')
                local has_sensors=$(echo "$device" | jq -r '.has_sensors')

                if [ "$has_sensors" = "true" ]; then
                    publish_sensors "$device_id" "$device"
                fi
            done
            echo ""
        fi

        # Publish locations at location interval
        if (( location_counter % LOCATION_INTERVAL == 0 )); then
            local has_any_mobile=false
            for i in $(seq 0 $((DEVICE_COUNT - 1))); do
                local device=$(jq ".devices[$i]" "$FULL_PATH")
                local has_location=$(echo "$device" | jq -r '.has_location')
                if [ "$has_location" = "true" ]; then
                    has_any_mobile=true
                    break
                fi
            done

            if [ "$has_any_mobile" = "true" ]; then
                echo -e "${YELLOW}[$now] Publishing location data...${NC}"
                for i in $(seq 0 $((DEVICE_COUNT - 1))); do
                    local device=$(jq ".devices[$i]" "$FULL_PATH")
                    local device_id=$(echo "$device" | jq -r '.device_id')
                    publish_location "$device_id" "$device"
                done
                echo ""
            fi
        fi

        sleep 1
        ((sensor_counter++))
        ((location_counter++))
    done
}

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping data generator...${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main
init_devices
run_generator
