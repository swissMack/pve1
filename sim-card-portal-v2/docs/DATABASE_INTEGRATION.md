# Database Integration & API Documentation

## Overview

This project now includes a complete API layer for database connectivity, enabling the transition from hardcoded mock data to a real database backend. The implementation provides a seamless fallback mechanism that maintains compatibility with existing mock data while adding production-ready database connectivity.

## Architecture

### API Layer (`/api` directory)

The project uses Vercel serverless functions to provide a REST API:

- **`/api/devices.ts`** - Device management endpoints
- **`/api/simcards.ts`** - SIM card management endpoints  
- **`/api/auth.ts`** - Authentication and token management
- **`/api/device-location-history.ts`** - Device GPS location history for route tracking
- **`/api/device-sensor-history.ts`** - Device sensor history for temperature, humidity, and light tracking

### Data Service Layer (`src/data/dataService.ts`)

A service layer that abstracts data access and provides:

- Automatic fallback from API to mock data
- Environment-based configuration
- Consistent error handling
- TypeScript type safety

### Frontend Integration

All components have been updated to use the data service:

- **DeviceList.vue** - Loads devices via dataService.getDevices()
- **SIMCardManagement.vue** - Loads SIM cards via dataService.getSIMCards()
- **WelcomePage.vue** - Loads statistics via both device and SIM card services

## Database Schema

### Expected Supabase Tables

#### `devices` table
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('Active', 'Inactive', 'Maintenance', 'Offline')),
  sim_card TEXT,
  device_type TEXT,
  location TEXT,
  last_seen TIMESTAMP,
  signal_strength INTEGER,
  data_usage TEXT,
  connection_type TEXT CHECK (connection_type IN ('4G', '5G', '3G', 'WiFi')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `sim_cards` table
```sql
CREATE TABLE sim_cards (
  id TEXT PRIMARY KEY,
  iccid TEXT UNIQUE NOT NULL,
  msisdn TEXT,
  status TEXT CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Terminated')),
  carrier TEXT,
  plan TEXT,
  data_used TEXT,
  data_limit TEXT,
  activation_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `users` table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `user_sessions` table
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `device_location_history` table
```sql
CREATE TABLE device_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude NUMERIC(10, 2),
  accuracy NUMERIC(10, 2),
  speed NUMERIC(10, 2),
  heading NUMERIC(5, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_source VARCHAR(50),
  battery_level INTEGER,
  signal_strength INTEGER,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `device_sensor_history` table
```sql
CREATE TABLE device_sensor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  temperature NUMERIC(5, 2),
  humidity NUMERIC(5, 2),
  light NUMERIC(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  battery_level INTEGER,
  signal_strength INTEGER,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database Connection (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Secret for authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# API Configuration
VITE_USE_API=true
VITE_API_BASE_URL=

# Development settings
NODE_ENV=production
```

### Development vs Production

- **Development**: Uses mock data by default (`VITE_USE_API=false`)
- **Production**: Uses API endpoints (`VITE_USE_API=true` or `NODE_ENV=production`)

## API Endpoints

### Device Management

#### GET `/api/devices`
Returns all devices
```json
{
  "success": true,
  "data": [
    {
      "id": "DEV001",
      "name": "IoT Sensor Alpha",
      "status": "Active",
      "simCard": "SIM001",
      "deviceType": "Temperature Sensor",
      "location": "Warehouse A",
      "lastSeen": "2024-01-15T14:30:22",
      "signalStrength": 85,
      "dataUsage": "2.4 MB",
      "connectionType": "4G"
    }
  ]
}
```

#### POST `/api/devices`
Create new device
```json
{
  "name": "New Device",
  "status": "Inactive",
  "simCard": "SIM123",
  "deviceType": "Sensor",
  "location": "Building A",
  "signalStrength": 0,
  "dataUsage": "0 MB",
  "connectionType": "4G"
}
```

#### PUT `/api/devices?id=DEV001`
Update existing device
```json
{
  "status": "Active",
  "signalStrength": 95,
  "dataUsage": "5.2 MB"
}
```

#### DELETE `/api/devices?id=DEV001`
Delete device

### SIM Card Management

#### GET `/api/simcards`
Returns all SIM cards

#### POST `/api/simcards`
Create new SIM card

#### PUT `/api/simcards?id=SIM001`
Update existing SIM card

#### DELETE `/api/simcards?id=SIM001`
Delete SIM card

### Authentication

#### POST `/api/auth`
Handle authentication actions:

**Login:**
```json
{
  "action": "login",
  "username": "admin",
  "password": "1234567"
}
```

**Verify Token:**
```json
{
  "action": "verify",
  "token": "jwt_token_here"
}
```

**Refresh Token:**
```json
{
  "action": "refresh",
  "token": "jwt_token_here"
}
```

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the SQL schema creation scripts (see Database Schema section)
3. Populate tables with initial data if needed
4. Get your project URL and API keys

### 2. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials
3. Set `VITE_USE_API=true` for production

### 3. Database Migration

To migrate from mock data to database:

1. Export mock data to CSV or JSON
2. Import data into Supabase tables
3. Update environment variables
4. Deploy to production

### 4. Authentication Setup

1. Hash passwords for user accounts
2. Insert admin user into `users` table
3. Configure JWT secret in environment

## Testing

### Development Testing
```bash
# Start development server (uses mock data)
npm run dev

# Test with API enabled
VITE_USE_API=true npm run dev
```

### Production Testing
```bash
# Build and preview
npm run build
npm run preview
```

## Security Considerations

### API Security
- All API endpoints include CORS headers
- JWT tokens expire after 24 hours
- Passwords should be hashed (bcrypt recommended)
- Service role key should be used for admin operations

### Environment Variables
- Never commit `.env` files to version control
- Use different secrets for different environments
- Rotate JWT secrets regularly

### Database Security
- Enable Row Level Security (RLS) in Supabase
- Create policies for user access control
- Use least-privilege access patterns

## Deployment

### Vercel Deployment

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables in Vercel
Add these in the Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

## Troubleshooting

### Common Issues

**API calls failing in development:**
- Check if development server is running
- Verify `VITE_USE_API` environment variable
- Check browser console for CORS errors

**Authentication not working:**
- Verify JWT secret is set correctly
- Check token expiration
- Verify user exists in database

**Database connection issues:**
- Verify Supabase credentials
- Check network connectivity
- Verify table schemas match expected structure

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=true npm run dev
```

## Performance Considerations

### Caching
- Implement Redis caching for frequently accessed data
- Use browser caching for static data
- Consider implementing pagination for large datasets

### Optimization
- Use database indexes for commonly queried fields
- Implement connection pooling
- Consider using Supabase edge functions for complex operations

## Future Enhancements

### Real-time Features
- Implement WebSocket connections for live updates
- Use Supabase real-time subscriptions
- Add push notifications for alerts

### Advanced Features
- Implement data analytics and reporting
- Add audit logging for all operations
- Implement backup and recovery procedures
- Add automated testing for API endpoints