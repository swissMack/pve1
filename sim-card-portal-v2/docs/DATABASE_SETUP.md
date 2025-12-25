# Database Setup Guide for Route Tracking Feature

This guide explains how to set up the database tables and populate them with mock data for the GPS route tracking feature.

## Prerequisites

- Supabase project with `sim-card-portal-v2` schema
- Database access credentials configured in environment variables
- PostgreSQL client or Supabase dashboard access

## Step 1: Create the Location History Table

Run the migration script to create the `device_location_history` table:

```sql
-- Execute this in your Supabase SQL Editor or via psql
\i migrations/001_create_device_location_history.sql
```

Or copy the contents of `migrations/001_create_device_location_history.sql` and execute in Supabase dashboard.

This creates:
- The `device_location_history` table with all necessary columns
- Three indexes for query optimization:
  - `idx_device_location_device_id` - Fast lookups by device
  - `idx_device_location_recorded_at` - Time-based sorting
  - `idx_device_location_device_time` - Combined device + time queries
- Table and column comments for documentation

## Step 2: Insert Mock Data

Populate the table with realistic Swiss route data:

```sql
-- Execute this in your Supabase SQL Editor or via psql
\i migrations/002_insert_mock_location_history.sql
```

Or copy the contents of `migrations/002_insert_mock_location_history.sql` and execute in Supabase dashboard.

This creates location history for:

### DEV003 (Vehicle Tracker)
- 7-day circular route through Switzerland
- Route: Zurich → Bern → Geneva → Basel → Zurich
- ~60 GPS points with realistic speeds (50-120 km/h)
- Additional 24-hour high-frequency tracking

### DEV007 (Asset Tracker)
- Local movement in St. Gallen area
- Low speeds (0-30 km/h)
- ~15 GPS points over 7 days

### DEV001 & DEV002 (IoT Sensors)
- Stationary devices with GPS drift
- ~7 points per device showing minimal movement
- Demonstrates accuracy variations

## Step 3: Verify Installation

Check that the table was created successfully:

```sql
-- Count records by device
SELECT 
  device_id, 
  COUNT(*) as point_count,
  MIN(recorded_at) as first_record,
  MAX(recorded_at) as last_record
FROM "sim-card-portal-v2".device_location_history
GROUP BY device_id
ORDER BY device_id;
```

Expected output:
```
device_id | point_count | first_record              | last_record
----------|-------------|---------------------------|---------------------------
DEV001    | 7           | (30 days ago)             | (1 day ago)
DEV002    | 7           | (30 days ago)             | (1 day ago)
DEV003    | ~60         | (7 days ago)              | (1 hour ago)
DEV007    | ~15         | (7 days ago)              | (1 day ago)
```

## Step 4: Test API Endpoint

Verify the API endpoint is working:

```bash
# Test fetching DEV003 location history for last 7 days
curl "http://localhost:3000/api/device-location-history?device_id=DEV003&start_date=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)&end_date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "deviceId": "DEV003",
      "latitude": 47.3769,
      "longitude": 8.5417,
      "speed": 85,
      "recordedAt": "...",
      ...
    }
  ],
  "count": 60
}
```

## Step 5: Configure Environment Variables

Ensure your `.env` file has the required variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Maps API (required for map visualization)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GOOGLE_MAPS_MAP_ID=your-map-id
```

## Troubleshooting

### Table creation fails

**Error**: `relation "devices" does not exist`

**Solution**: Ensure the main `devices` table exists in the `sim-card-portal-v2` schema before creating `device_location_history`.

### Foreign key constraint violation

**Error**: `insert or update on table "device_location_history" violates foreign key constraint`

**Solution**: Make sure device IDs in the mock data match existing devices in your `devices` table. Update device IDs in `002_insert_mock_location_history.sql` if needed.

### API returns empty data

**Error**: API returns `{"success": true, "data": [], "count": 0}`

**Possible causes**:
1. Mock data not inserted - check database with SELECT query
2. Date range doesn't match data - mock data uses relative dates (NOW() - INTERVAL)
3. Device ID mismatch - verify device IDs are correct

### Permission denied

**Error**: `permission denied for schema sim-card-portal-v2`

**Solution**: Ensure your Supabase service role key has proper permissions. Use the service role key (not anon key) in the API.

## Data Maintenance

### Adding New Location Records

To add a single location record programmatically:

```bash
curl -X POST http://localhost:3000/api/device-location-history \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "DEV003",
    "latitude": 47.3769,
    "longitude": 8.5417,
    "altitude": 408,
    "speed": 65,
    "heading": 90,
    "locationSource": "gps",
    "batteryLevel": 75,
    "signalStrength": 85
  }'
```

### Bulk Data Generation

For generating larger datasets with custom routes, modify `002_insert_mock_location_history.sql` or create a custom script using the API endpoint.

### Cleaning Old Data

To remove location history older than 90 days:

```sql
DELETE FROM "sim-card-portal-v2".device_location_history
WHERE recorded_at < NOW() - INTERVAL '90 days';
```

### Data Archival

For long-term storage, consider archiving old records:

```sql
-- Create archive table (one-time)
CREATE TABLE "sim-card-portal-v2".device_location_history_archive (
  LIKE "sim-card-portal-v2".device_location_history INCLUDING ALL
);

-- Move old records to archive
INSERT INTO "sim-card-portal-v2".device_location_history_archive
SELECT * FROM "sim-card-portal-v2".device_location_history
WHERE recorded_at < NOW() - INTERVAL '90 days';

-- Delete archived records from main table
DELETE FROM "sim-card-portal-v2".device_location_history
WHERE recorded_at < NOW() - INTERVAL '90 days';
```

## Performance Optimization

### Index Monitoring

Check index usage:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'device_location_history';
```

### Query Performance

For optimal performance:
- Always include `device_id` in WHERE clauses
- Use date range filters to limit result sets
- Consider pagination for large result sets
- Use the composite index for device + time queries

### Vacuum and Analyze

Periodically optimize the table:

```sql
VACUUM ANALYZE "sim-card-portal-v2".device_location_history;
```

## Next Steps

After setting up the database:
1. Restart your API server to ensure it can connect
2. Open the application and navigate to Devices → Device Details → Route History
3. View the visualized routes on the map
4. Test different date ranges and devices
5. Verify route statistics are calculated correctly
