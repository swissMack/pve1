#!/bin/bash
# InfluxDB Restore Script
# Restores InfluxDB from a backup file

set -e

# Configuration
INFLUXDB_CONTAINER="${INFLUXDB_CONTAINER:-mqtt-influxdb}"
INFLUXDB_ORG="${INFLUXDB_ORG:-mqtt-org}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-mqtt-influxdb-token}"

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/influxdb/*.tar.gz 2>/dev/null || echo "  No backups found in backups/influxdb/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "=== InfluxDB Restore ==="
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Warning
echo "WARNING: This will restore data from the backup."
echo "Existing data with the same bucket names may be overwritten."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${INFLUXDB_CONTAINER}$"; then
    echo "Error: Container ${INFLUXDB_CONTAINER} is not running"
    exit 1
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
BACKUP_NAME=$(basename ${BACKUP_FILE} .tar.gz)

echo "--- Extracting backup ---"
tar -xzf ${BACKUP_FILE} -C ${TEMP_DIR}

# Find the backup directory
BACKUP_DIR=$(find ${TEMP_DIR} -type d -name "influxdb_backup_*" | head -1)
if [ -z "${BACKUP_DIR}" ]; then
    BACKUP_DIR="${TEMP_DIR}/${BACKUP_NAME}"
fi

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "Error: Could not find backup data in archive"
    rm -rf ${TEMP_DIR}
    exit 1
fi

echo "--- Copying backup to container ---"
docker cp ${BACKUP_DIR} ${INFLUXDB_CONTAINER}:/tmp/restore_data

echo "--- Restoring data ---"
docker exec ${INFLUXDB_CONTAINER} influx restore \
    /tmp/restore_data \
    --org ${INFLUXDB_ORG} \
    --token ${INFLUXDB_TOKEN} \
    --full

# Cleanup
echo "--- Cleaning up ---"
docker exec ${INFLUXDB_CONTAINER} rm -rf /tmp/restore_data
rm -rf ${TEMP_DIR}

echo ""
echo "=== Restore Complete ==="
echo ""

# Verify restoration
echo "--- Verifying buckets ---"
docker exec ${INFLUXDB_CONTAINER} influx bucket list \
    --org ${INFLUXDB_ORG} \
    --token ${INFLUXDB_TOKEN}
