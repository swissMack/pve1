# GPS Route Tracking Feature

## Overview

The GPS Route Tracking feature enables visualization of historical device movement on an interactive map. This feature is particularly useful for tracking vehicles, assets, and mobile IoT devices across Switzerland.

## Features

### 1. Historical Route Visualization
- Display device movement history as a polyline on Google Maps
- Start marker (green) and end marker (red) with labels
- Gradient route showing direction of travel
- Swiss-focused coordinate boundaries

### 2. Route Statistics
- **Total Distance**: Calculated using Haversine formula
- **Average Speed**: Based on recorded speed data points
- **Max Speed**: Highest recorded speed during the route
- **Data Points**: Number of GPS records
- **Time Range**: Start and end timestamps of the route
- **Battery Drop**: Change in battery level over the route

### 3. Date Range Filtering
- Last 24 Hours
- Last 7 Days
- Last 30 Days

### 4. Interactive Map Features
- Click on start/end markers to view detailed information
- Auto-fit bounds to show entire route
- Zoom and pan controls
- Full-screen map option

## Architecture

### Database Schema

**Table**: `sim-card-portal-v2.device_location_history`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| device_id | VARCHAR | Foreign key to devices table |
| latitude | NUMERIC(10, 7) | Latitude coordinate |
| longitude | NUMERIC(10, 7) | Longitude coordinate |
| altitude | NUMERIC(10, 2) | Elevation in meters (optional) |
| accuracy | NUMERIC(10, 2) | GPS accuracy in meters (optional) |
| speed | NUMERIC(10, 2) | Speed in km/h (optional) |
| heading | NUMERIC(5, 2) | Direction 0-360 degrees (optional) |
| recorded_at | TIMESTAMPTZ | Timestamp when location was recorded |
| location_source | VARCHAR(50) | Source: 'gps', 'cell_tower', 'wifi', 'manual' |
| battery_level | INTEGER | Battery level 0-100 at recording time |
| signal_strength | INTEGER | Signal strength 0-100 at recording time |
| notes | TEXT | Additional notes (optional) |
| metadata | JSONB | Flexible additional data (optional) |
| created_at | TIMESTAMPTZ | Record creation timestamp |

**Indexes**:
- `idx_device_location_device_id` - On device_id for fast device-specific queries
- `idx_device_location_recorded_at` - On recorded_at DESC for time-based sorting
- `idx_device_location_device_time` - Composite on (device_id, recorded_at DESC) for optimal query performance

### API Endpoints

#### GET `/api/device-location-history`

Fetch location history for a device.

**Query Parameters**:
- `device_id` (required): Device identifier
- `start_date` (optional): ISO 8601 timestamp for range start
- `end_date` (optional): ISO 8601 timestamp for range end
- `limit` (optional, default: 1000): Maximum number of records to return

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "deviceId": "DEV003",
      "latitude": 47.3769,
      "longitude": 8.5417,
      "altitude": 408,
      "accuracy": 10,
      "speed": 85,
      "heading": 270,
      "recordedAt": "2024-01-15T10:30:00Z",
      "locationSource": "gps",
      "batteryLevel": 95,
      "signalStrength": 88,
      "notes": null,
      "metadata": null
    }
  ],
  "count": 1
}
```

#### POST `/api/device-location-history`

Create a new location record.

**Request Body**:
```json
{
  "deviceId": "DEV003",
  "latitude": 47.3769,
  "longitude": 8.5417,
  "altitude": 408,
  "accuracy": 10,
  "speed": 85,
  "heading": 270,
  "recordedAt": "2024-01-15T10:30:00Z",
  "locationSource": "gps",
  "batteryLevel": 95,
  "signalStrength": 88
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* created record */ }
}
```

### Frontend Components

#### DeviceRouteMap.vue

Main route visualization component.

**Props**:
- `deviceId` (string, required): Device to display route for

**Features**:
- Automatic data loading based on selected date range
- Real-time route statistics calculation
- Responsive map container
- Loading/error/empty states

**Usage**:
```vue
<DeviceRouteMap :deviceId="device.id" />
```

#### DeviceDetail.vue Integration

The route map is integrated as a tab in the device details dialog:
- **Tab 1**: Device Info (existing panels)
- **Tab 2**: Route History (new route map component)

## User Guide

### Viewing Device Route History

1. **Open Device List**: Navigate to the Devices tab in the main navigation
2. **Select Device**: Click on a device row to open the device details dialog
3. **Switch to Route History**: Click the "Route History" tab
4. **Select Date Range**: Choose from 24 hours, 7 days, or 30 days
5. **Explore the Map**:
   - Pan and zoom to explore the route
   - Click start (green) or end (red) markers for details
   - View route statistics in the panel above the map

### Understanding Route Statistics

- **Total Distance**: Sum of distances between consecutive GPS points
- **Average Speed**: Mean of all recorded speeds (excludes zero/null values)
- **Max Speed**: Highest recorded speed during the time period
- **Data Points**: Number of GPS records in the selected range
- **Time Range**: Formatted date/time of first and last records
- **Battery Drop**: Difference between first and last battery readings

## Mock Data

The system includes realistic mock data for Swiss device movements:

### DEV003 (Vehicle Tracker)
- 7-day circular route: Zurich → Bern → Geneva → Basel → Zurich
- Highway speeds (50-120 km/h)
- ~700 km total distance
- Frequent updates (every 30-60 minutes while moving)

### DEV007 (Asset Tracker)
- Local movement in St. Gallen area
- Lower speeds (0-30 km/h)
- Smaller geographic area
- Intermittent tracking

### DEV001, DEV002 (IoT Sensors)
- Stationary devices with GPS drift
- Minimal movement (±100m)
- Demonstrates sensor accuracy variations

## Implementation Notes

### Swiss Coordinate Boundaries

The mock data respects Swiss geographic boundaries:
- **North**: 47.8° (Schaffhausen)
- **South**: 45.8° (Ticino)
- **East**: 10.5° (Graubünden)
- **West**: 5.9° (Geneva)

### Distance Calculation

Uses the Haversine formula for accurate distance calculation:
```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
```

### Performance Considerations

- Default query limit: 1000 points
- Route points are rendered as a single polyline (efficient)
- Only start/end markers are added (prevents marker clutter)
- Auto-fit bounds optimizes initial view

## Database Setup

To set up the database tables and populate with mock data:

```sql
-- Run migration files in order
\i migrations/001_create_device_location_history.sql
\i migrations/002_insert_mock_location_history.sql
```

Or use Supabase dashboard to execute the SQL scripts.

## Future Enhancements

Potential improvements for future versions:

1. **Real-time Tracking**: Live position updates using WebSocket
2. **Route Playback**: Animated playback of route with speed control
3. **Geofencing**: Alert zones and boundary violations
4. **Heatmaps**: Density visualization for frequently visited areas
5. **Multi-device Routes**: Compare routes of multiple devices
6. **Export Options**: GPX, KML, CSV export formats
7. **Advanced Filters**: Filter by speed, altitude, time of day
8. **Route Clustering**: Group similar routes automatically

## Troubleshooting

### No route data displayed
- Check that device has location history in database
- Verify date range includes actual GPS records
- Check browser console for API errors

### Map not loading
- Verify Google Maps API key is configured in `.env`
- Check that Google Maps API is enabled in Google Cloud Console
- Ensure internet connectivity

### Performance issues with large datasets
- Reduce date range to limit number of points
- Consider implementing pagination for very large datasets
- Use route simplification algorithms for better performance

## Support

For issues or questions about the route tracking feature, please:
1. Check this documentation
2. Review browser console for errors
3. Check API endpoint responses
4. Verify database table structure and data
