# Configuration Reference

This document describes all environment variables used by the SIM Card Portal v2 and MQTT Control Panel applications.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your environment-specific values

3. Start the application:
   ```bash
   # For Docker deployment
   docker compose up -d

   # For local development
   npm run dev
   ```

## Environment Files

| File | Purpose | Tracked in Git |
|------|---------|----------------|
| `.env.example` | Template with all variables | Yes |
| `.env` | Production/default values | No |
| `.env.local` | Local development overrides | No |
| `.env.production` | Production-specific values | No |

## SIM Card Portal v2 Variables

### Required Variables

These variables are required for the application to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5433/db` |
| `MQTT_BROKER_URL` | MQTT broker TCP connection | `mqtt://mqtt-emqx:1883` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | - |
| `DB_HOST` | Database host (if not using URL) | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `postgres` |
| `DB_MAX_CONNECTIONS` | Connection pool size | `20` |
| `DB_IDLE_TIMEOUT` | Idle connection timeout (ms) | `30000` |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | `2000` |

### MQTT Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_BROKER_URL` | MQTT broker TCP URL (backend) | - |
| `VITE_MQTT_BROKER_URL` | MQTT WebSocket URL (frontend) | Auto-detected |
| `VITE_MQTT_WS_PORT` | WebSocket port for auto-detection | `8083` |
| `MQTT_USERNAME` | MQTT authentication username | - |
| `MQTT_PASSWORD` | MQTT authentication password | - |
| `MQTT_CLIENT_ID` | MQTT client identifier | `simcard-portal-bridge` |
| `MQTT_USE_TLS` | Enable TLS encryption | `false` |
| `MQTT_TOPIC_PREFIX` | Topic prefix for device messages | `simportal/devices` |

### WebSocket Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBSOCKET_PORT` | WebSocket server port | `3002` |
| `WEBSOCKET_PATH` | WebSocket endpoint path | `/ws` |
| `VITE_WEBSOCKET_URL` | Frontend WebSocket URL | Auto-detected |

### API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API server port | `3001` |
| `VITE_USE_API` | Enable API integration | `false` |
| `VITE_API_URL` | API URL for frontend | `/api` (proxied) |
| `ANALYTICS_API_URL` | Analytics service URL | `http://localhost:9010` |
| `VITE_ANALYTICS_API_URL` | Frontend analytics URL | `/api/analytics` |

### External Services

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | - |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google Maps Map ID | - |
| `ANTHROPIC_API_KEY` | Claude API key (LLM features) | - |

### Monitoring & Observability

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_GRAFANA_URL` | Grafana dashboard URL | `http://localhost:3000` |
| `VITE_INFLUXDB_URL` | InfluxDB URL | `http://localhost:8086` |
| `VITE_INFLUXDB_TOKEN` | InfluxDB authentication token | - |
| `EMQX_API_URL` | EMQX Management API URL | `http://localhost:18083` |
| `VITE_EMQX_DASHBOARD_URL` | EMQX Dashboard URL (frontend) | `http://localhost:18083` |

### Development Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_AUTH` | Skip authentication (dev only) | `false` |
| `NODE_ENV` | Node environment | `development` |
| `VITE_PORT` | Vite dev server port | `5173` |

### Docker Deployment Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | External API port mapping | `3001` |
| `FRONTEND_PORT` | External frontend port mapping | `8080` |
| `WEBSOCKET_PORT` | External WebSocket port mapping | `3002` |

## MQTT Control Panel Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MQTT_BROKER_URL` | MQTT broker TCP connection | `mqtt://192.168.1.59:1883` |
| `EMQX_API_URL` | EMQX Management API URL | `http://192.168.1.59:18083` |

### Host Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `PROXMOX_HOST` | Proxmox server IP/hostname | `192.168.1.59` |
| `MAC_HOST` | Local development machine | `localhost` |

### Backend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | Express server port | `3003` |
| `VITE_BACKEND_API_URL` | Backend API URL for frontend | `http://localhost:3003/api` |
| `DOCKER_DIR` | Docker project directory | Auto-detected |

### Service URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_PORTAL_API_URL` | SIM Card Portal API URL | `http://localhost:3001` |
| `VITE_ANALYTICS_API_URL` | Analytics API URL | `http://localhost:9010` |
| `VITE_GRAFANA_URL` | Grafana dashboard URL | `http://localhost:3000` |
| `VITE_INFLUXDB_URL` | InfluxDB URL | `http://localhost:8086` |

## Deployment Scenarios

### Local Development

```bash
# sim-card-portal-v2/.env.local
DB_HOST=localhost
DB_PORT=5432
MQTT_BROKER_URL=mqtt://localhost:1883
VITE_MQTT_BROKER_URL=ws://localhost:8083/mqtt
SKIP_AUTH=true
```

### Docker (Same Machine)

```bash
# sim-card-portal-v2/.env
DB_HOST=host.docker.internal
MQTT_BROKER_URL=mqtt://mqtt-emqx:1883
VITE_MQTT_BROKER_URL=ws://localhost:8083/mqtt
```

### Docker (Proxmox Server)

```bash
# sim-card-portal-v2/.env
DB_HOST=192.168.1.59
DB_PORT=5433
MQTT_BROKER_URL=mqtt://mqtt-emqx:1883
VITE_MQTT_BROKER_URL=ws://192.168.1.59:8083/mqtt
```

### Production

```bash
# Use environment variables from secrets manager
# Do not use .env files in production
export DATABASE_URL="postgresql://user:pass@db.example.com:5432/simportal"
export MQTT_BROKER_URL="mqtt://mqtt.example.com:1883"
```

## Fail-Fast Behavior

The following components require specific environment variables and will exit with an error if they are not set:

### MQTT Control Panel Server (`tools/mqtt-control-panel/server.js`)

- `MQTT_BROKER_URL` - Required for MQTT connection
- `EMQX_API_URL` - Required for EMQX management API

Example error:
```
ERROR: MQTT_BROKER_URL environment variable is required
Example: MQTT_BROKER_URL=mqtt://localhost:1883
```

## Variable Naming Conventions

| Prefix | Usage |
|--------|-------|
| `VITE_` | Frontend variables (exposed to browser) |
| `DB_` | Database connection settings |
| `MQTT_` | MQTT/broker configuration |
| `WEBSOCKET_` | WebSocket server settings |
| `ANALYTICS_` | Analytics service settings |

## Security Notes

1. **Never commit `.env` files** - They are excluded via `.gitignore`
2. **API keys and passwords** - Store in environment variables, not in code
3. **Production secrets** - Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
4. **Frontend variables** - Any `VITE_` prefixed variable is exposed to the browser; never include secrets

## Troubleshooting

### Application won't start

1. Check required environment variables are set:
   ```bash
   echo $DATABASE_URL
   echo $MQTT_BROKER_URL
   ```

2. Verify `.env` file exists and is readable:
   ```bash
   ls -la .env
   cat .env | grep -v PASSWORD
   ```

### Docker containers can't connect

1. Verify network configuration:
   ```bash
   docker network ls
   docker network inspect mqtt-network
   ```

2. Use Docker service names instead of IPs when containers are on the same network:
   ```bash
   MQTT_BROKER_URL=mqtt://mqtt-emqx:1883  # Not mqtt://192.168.1.59:1883
   ```

### Frontend can't connect to services

1. Check browser console for CORS errors
2. Verify `VITE_*` variables are set before build
3. Rebuild frontend after changing environment variables:
   ```bash
   npm run build
   ```
