#!/bin/bash
# InfluxDB Backup Script
# Creates timestamped backups of all InfluxDB data

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/influxdb}"
INFLUXDB_CONTAINER="${INFLUXDB_CONTAINER:-mqtt-influxdb}"
INFLUXDB_ORG="${INFLUXDB_ORG:-mqtt-org}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-mqtt-influxdb-token}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="influxdb_backup_${TIMESTAMP}"

echo "=== InfluxDB Backup ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Backup directory: ${BACKUP_DIR}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${INFLUXDB_CONTAINER}$"; then
    echo "Error: Container ${INFLUXDB_CONTAINER} is not running"
    exit 1
fi

echo "--- Creating backup ---"

# Create backup inside container
docker exec ${INFLUXDB_CONTAINER} influx backup \
    /tmp/${BACKUP_NAME} \
    --org ${INFLUXDB_ORG} \
    --token ${INFLUXDB_TOKEN}

# Copy backup from container
docker cp ${INFLUXDB_CONTAINER}:/tmp/${BACKUP_NAME} ${BACKUP_DIR}/

# Compress backup
echo "--- Compressing backup ---"
cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}
rm -rf ${BACKUP_NAME}

# Clean up inside container
docker exec ${INFLUXDB_CONTAINER} rm -rf /tmp/${BACKUP_NAME}

# Calculate backup size
BACKUP_SIZE=$(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)
echo "Backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Cleanup old backups
echo ""
echo "--- Cleaning old backups (older than ${RETENTION_DAYS} days) ---"
find ${BACKUP_DIR} -name "influxdb_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete -print 2>/dev/null || true

# List current backups
echo ""
echo "--- Current backups ---"
ls -lh ${BACKUP_DIR}/*.tar.gz 2>/dev/null || echo "No backups found"

echo ""
echo "=== Backup Complete ==="
echo "File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
