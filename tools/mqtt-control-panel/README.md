# MQTT Control Panel

A Vue.js-based control panel for managing and monitoring MQTT IoT device simulators.

## Quick Start

```bash
cd tools/mqtt-control-panel
npm install
npm run dev
```

The control panel will be available at **http://localhost:5174**

## Reserved Ports

The following ports are reserved for the MQTT ecosystem. Ensure these ports are available before starting services.

| Port  | Service              | Protocol    | Description                          |
|-------|----------------------|-------------|--------------------------------------|
| 1883  | EMQX                 | MQTT TCP    | Standard MQTT broker connection      |
| 3000  | Grafana              | HTTP        | Metrics visualization dashboard      |
| 5174  | MQTT Control Panel   | HTTP        | Device simulator control interface   |
| 8083  | EMQX                 | WebSocket   | MQTT over WebSocket                  |
| 8084  | EMQX                 | WSS         | MQTT over WebSocket (TLS)            |
| 8086  | InfluxDB             | HTTP        | Time-series database API             |
| 8883  | EMQX                 | MQTT TLS    | Secure MQTT broker connection        |
| 9090  | Prometheus           | HTTP        | Metrics collection                   |
| 18083 | EMQX Dashboard       | HTTP        | EMQX management interface            |

## Checking Port Availability

Before starting services, verify ports are free:

```bash
# Check if a specific port is in use
lsof -i :5174

# Check all reserved ports
for port in 1883 3000 5174 8083 8084 8086 8883 9090 18083; do
  lsof -i :$port 2>/dev/null && echo "Port $port is IN USE" || echo "Port $port is available"
done
```

## Features

- Real-time device status monitoring
- Sensor value control (temperature, humidity, battery, light)
- Sensor interval adjustment (10s to 7 days with smart rounding)
- Location and movement controls for mobile devices
- MQTT connection status
- InfluxDB telemetry dashboard
- Fleet health visualization

## Configuration

The control panel connects to:
- **MQTT Broker**: `localhost:1883` (WebSocket: `localhost:8083`)
- **InfluxDB**: `localhost:8086`

## Scripts

| Command         | Description                    |
|-----------------|--------------------------------|
| `npm run dev`   | Start development server       |
| `npm run build` | Build for production           |
| `npm run preview` | Preview production build     |
| `npm run server` | Start backend API server      |
