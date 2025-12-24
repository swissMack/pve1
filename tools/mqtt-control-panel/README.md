# MQTT Control Panel

A Vue.js-based control panel for managing and monitoring MQTT IoT device simulators, with integration to the SIM Card Portal for billing and provisioning.

## Quick Start

```bash
cd tools/mqtt-control-panel
npm install

# Start all services
npm run start:all

# Or start individually:
npm run dev      # Frontend (Vite)
npm run server   # MQTT Control API (server.js)
npm run api      # Billing Mock API (api-server.js) - optional
```

The control panel will be available at **http://localhost:5174**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MQTT Control Panel (Vite)                     │
│                     http://localhost:5174                        │
└─────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
┌─────────────────────┐         ┌─────────────────────┐
│   System Tab        │         │  Billing/Provisioning│
│   localhost:3003    │         │   localhost:3001     │
│   (server.js)       │         │   (Docker container) │
└─────────────────────┘         └─────────────────────┘
          │                                 │
          ▼                                 ▼
┌─────────────────────┐         ┌─────────────────────┐
│ • Generator control │         │ • SIM card list      │
│ • EMQX stats        │         │ • Usage submission   │
│ • MQTT messages     │         │ • Health check       │
│ • Docker services   │         │ • Activate/Block     │
└─────────────────────┘         └─────────────────────┘
```

## Backend Services

### 1. MQTT Control API (`server.js`) - Port 3003

Provides Docker container control and MQTT monitoring:

- **Generator Control**: Start/stop/restart the data generator container
- **EMQX Stats**: Broker statistics (connections, subscriptions, topics)
- **MQTT Messages**: Real-time message flow monitoring
- **Services Status**: Health of all MQTT ecosystem containers

```bash
# Start manually
node server.js
# Or with custom port
API_PORT=3003 node server.js
```

### 2. SIM Card Portal API (Docker) - Port 3001

The `simcard-portal-api` Docker container provides:

- SIM card inventory management
- Usage data submission
- Billing and provisioning operations

**Connection config**: `src/services/simPortalService.js`
```javascript
const PORTAL_API_BASE = 'http://localhost:3001'
const API_KEY = 'test_provisioning_key_12345'
```

## Reserved Ports

| Port  | Service                | Protocol    | Description                          |
|-------|------------------------|-------------|--------------------------------------|
| 1883  | EMQX                   | MQTT TCP    | Standard MQTT broker connection      |
| 3000  | Grafana                | HTTP        | Metrics visualization dashboard      |
| 3001  | simcard-portal-api     | HTTP        | SIM Portal REST API (Docker)         |
| 3003  | server.js              | HTTP        | MQTT Control Panel backend           |
| 5174  | MQTT Control Panel     | HTTP        | Device simulator control interface   |
| 8083  | EMQX                   | WebSocket   | MQTT over WebSocket                  |
| 8084  | EMQX                   | WSS         | MQTT over WebSocket (TLS)            |
| 8086  | InfluxDB               | HTTP        | Time-series database API             |
| 8883  | EMQX                   | MQTT TLS    | Secure MQTT broker connection        |
| 9090  | Prometheus             | HTTP        | Metrics collection                   |
| 18083 | EMQX Dashboard         | HTTP        | EMQX management interface            |

## Checking Port Availability

Before starting services, verify ports are free:

```bash
# Check if a specific port is in use
lsof -i :5174

# Check all reserved ports
for port in 1883 3000 3001 3003 5174 8083 8084 8086 8883 9090 18083; do
  lsof -i :$port 2>/dev/null && echo "Port $port is IN USE" || echo "Port $port is available"
done
```

## Features

### System Tab
- Real-time MQTT message flow monitoring
- Data generator container control (start/stop/restart)
- EMQX broker statistics
- Docker service health status

### Simulator Tab
- Real-time device status monitoring
- Sensor value control (temperature, humidity, battery, light)
- Sensor interval adjustment (10s to 7 days with smart rounding)
- Location and movement controls for mobile devices
- MQTT connection status

### Billing & Provisioning
- SIM card inventory from SIM Portal
- Usage data submission to portal
- Carrier and plan management
- Activation/deactivation controls

## Configuration

### Frontend API Connections

| Component | File | Variable | Default |
|-----------|------|----------|---------|
| System Tab | `src/components/SystemStatus.vue` | `API_BASE` | `http://localhost:3003/api` |
| SIM Portal | `src/services/simPortalService.js` | `PORTAL_API_BASE` | `http://localhost:3001` |
| Billing API | `src/services/api.js` | `API_BASE` | `http://localhost:3001` |

### Backend Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3003` | Port for server.js |
| `DOCKER_DIR` | `/Users/mackmood/MQTTServer/docker` | Docker compose directory |

## Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start Vite development server            |
| `npm run build`   | Build for production                     |
| `npm run preview` | Preview production build                 |
| `npm run server`  | Start MQTT Control API (server.js)       |
| `npm run api`     | Start Billing Mock API (api-server.js)   |
| `npm run start`   | Start all services concurrently          |
| `npm run start:all` | Start all services concurrently        |

## Docker Dependencies

Ensure these containers are running:

```bash
# Check status
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "mqtt|simcard"

# Expected containers:
# - mqtt-emqx (MQTT broker)
# - mqtt-data-generator (sensor data publisher)
# - mqtt-influxdb (time-series storage)
# - mqtt-prometheus (metrics)
# - mqtt-grafana (dashboards)
# - simcard-portal-api (SIM management API)
```

## Troubleshooting

### "Load failed" on System Tab
1. Ensure `server.js` is running on port 3003
2. Check Docker is running and containers are up
3. Verify MQTT broker (EMQX) is healthy

### No MQTT messages flowing
1. Check `mqtt-data-generator` container status
2. Verify EMQX is running on port 1883
3. Check server.js console for "MQTT monitor connected"

### SIM Portal connection issues
1. Verify `simcard-portal-api` container is running on port 3001
2. Test API: `curl http://localhost:3001/api/v1/health`
3. Check API key in `simPortalService.js`
