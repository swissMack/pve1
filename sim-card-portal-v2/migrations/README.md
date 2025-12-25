# Database Migrations

This directory contains SQL migrations for the SIM Card Portal v2 database schema.

## Migration Files

### 001_create_device_location_history.sql
Creates the `device_location_history` table for GPS route tracking functionality.

**Features:**
- Stores historical GPS coordinates for devices
- Includes additional data like speed, heading, altitude, accuracy
- Records battery level and signal strength at time of recording
- Supports flexible metadata storage via JSONB column

### 002_insert_mock_location_history.sql
Inserts mock historical location data for development and testing.

**Data Included:**
- Route history for DEV-001 (Smart Tracker) - 7 days of movement
- Route history for DEV-002 (IoT Gateway) - Static location over 30 days
- Route history for DEV-003 (Fleet Tracker) - Long-distance journey over 1 year

### 003_create_device_sensor_history.sql
Creates the `device_sensor_history` table for environmental sensor tracking.

**Features:**
- Stores historical sensor readings (temperature, humidity, light)
- Records battery level and signal strength at time of recording
- Supports flexible metadata storage via JSONB column
- Indexed for efficient querying by device_id and recorded_at

### 004_insert_mock_sensor_history.sql
Inserts mock historical sensor data for development and testing.

**Data Included:**
- DEV-001 (Smart Tracker) - 7 days of frequent sensor readings
- DEV-002 (IoT Gateway) - 30 days of daily average readings
- DEV-003 (Fleet Tracker) - 1 year of historical data with varying frequencies

## Running Migrations

### Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Connect to your Supabase project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of each migration file in order
4. Execute each migration

### Using psql

If you have direct database access:

```bash
# Set your connection string
export DATABASE_URL="postgresql://user:pass@host:port/database"

# Run migrations in order
psql $DATABASE_URL -f migrations/001_create_device_location_history.sql
psql $DATABASE_URL -f migrations/002_insert_mock_location_history.sql
psql $DATABASE_URL -f migrations/003_create_device_sensor_history.sql
psql $DATABASE_URL -f migrations/004_insert_mock_sensor_history.sql
```

## Schema Information

All tables are created within the `sim-card-portal-v2` schema. Ensure this schema exists before running migrations:

```sql
CREATE SCHEMA IF NOT EXISTS "sim-card-portal-v2";
```

## Indexes

The migrations automatically create indexes for optimal query performance:

**device_location_history:**
- `idx_device_location_device_id` - For device-specific queries
- `idx_device_location_recorded_at` - For time-based queries
- `idx_device_location_device_time` - For combined device + time queries

**device_sensor_history:**
- `idx_device_sensor_device_id` - For device-specific queries
- `idx_device_sensor_recorded_at` - For time-based queries
- `idx_device_sensor_device_time` - For combined device + time queries

## Foreign Key Constraints

Both history tables have foreign key constraints to the `devices` table with `ON DELETE CASCADE`, meaning:
- When a device is deleted, all its historical data is automatically deleted
- This maintains referential integrity

## Data Retention

Consider implementing data retention policies for history tables:
- Archive old data periodically
- Implement automatic cleanup for data older than X months/years
- Use PostgreSQL partitioning for large datasets

## Testing

After running migrations, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'sim-card-portal-v2' 
AND table_name LIKE '%history%';

-- Check data was inserted
SELECT COUNT(*) FROM "sim-card-portal-v2".device_location_history;
SELECT COUNT(*) FROM "sim-card-portal-v2".device_sensor_history;
```

## Rollback

To rollback these migrations (⚠️ destroys all data):

```sql
-- Drop sensor history table
DROP TABLE IF EXISTS "sim-card-portal-v2".device_sensor_history CASCADE;

-- Drop location history table
DROP TABLE IF EXISTS "sim-card-portal-v2".device_location_history CASCADE;
```

## Notes

- Mock data uses realistic Swiss locations (Zurich, Geneva, Basel, etc.)
- Timestamps are relative to NOW() for dynamic testing
- Sensor values use realistic ranges for environmental monitoring
- All migrations include documentation comments
