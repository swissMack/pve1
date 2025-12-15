# MQTTServer

Containerized MQTT Test Ecosystem - A production-ready MQTT broker environment for testing and development.

## Overview

This project provides a complete MQTT testing ecosystem using Docker Compose, featuring:

- **EMQX 5.x** - Enterprise-grade MQTT broker with MQTT 3.1.1/5.0 support
- **InfluxDB 2.x** - Time-series database for message history and telemetry
- **Prometheus** - Metrics collection and alerting
- **Grafana** - Dashboards and visualization

## Quick Start

```bash
# Clone and enter directory
cd MQTTServer

# Copy environment file
cp docker/.env.example docker/.env

# Start all services
docker compose -f docker/docker-compose.yml up -d

# Verify services are running
docker compose -f docker/docker-compose.yml ps
```

For detailed setup instructions, see [quickstart.md](specs/001-mqtt-test-ecosystem/quickstart.md).

## Features

### MQTT Protocol Support
- MQTT 3.1.1 and 5.0 protocols
- QoS 0, 1, and 2 message delivery
- Shared subscriptions for load balancing
- Retained messages and session persistence
- WebSocket support (ports 8083/8084)

### Security
- TLS encryption (port 8883)
- Username/password authentication
- Client certificate authentication (mTLS)
- ACL-based topic authorization

### Observability
- Prometheus metrics endpoint
- Pre-configured Grafana dashboards
- Structured JSON logging
- Health check endpoints

### Message Persistence
- InfluxDB storage with configurable retention (12h/24h/48h/7d)
- Message replay functionality
- Dead letter queue for undeliverable messages

### Device Management
- Device twin/shadow pattern
- Online/offline status tracking
- Delta synchronization for offline devices

### Rules Engine
- Topic-based message routing
- Payload transformation
- HTTP webhook integration
- InfluxDB data bridge

## Access Points

| Service | Port | Description |
|---------|------|-------------|
| MQTT TCP | 1883 | Standard MQTT connections |
| MQTT TLS | 8883 | Encrypted MQTT connections |
| MQTT WS | 8083 | WebSocket connections |
| MQTT WSS | 8084 | Secure WebSocket connections |
| EMQX Dashboard | 18083 | Web management UI (admin/public) |
| InfluxDB | 8086 | Time-series API |
| Prometheus | 9090 | Metrics API |
| Grafana | 3000 | Dashboards (admin/admin) |

## Connecting with MQTT Explorer

[MQTT Explorer](https://mqtt-explorer.com/) is a graphical MQTT client for visualizing topics and messages.

### Connection Settings

| Setting | Value |
|---------|-------|
| Protocol | mqtt:// |
| Host | localhost (or your machine IP) |
| Port | 1883 |
| Username | (leave empty) |
| Password | (leave empty) |

### Useful Topics to Subscribe

| Topic Pattern | Description |
|---------------|-------------|
| `simportal/#` | All SIM Portal device messages |
| `simportal/devices/+/sensors` | Sensor data from all devices |
| `simportal/devices/+/location` | GPS location from all devices |
| `simportal/devices/+/status` | Device status updates |
| `simportal/devices/+/commands` | Commands sent to devices |
| `simportal/devices/+/config` | Device configuration |

### Alternative Connection Options

- **WebSocket**: `ws://localhost:8083` (for browser-based clients)
- **TLS**: `mqtts://localhost:8883` (requires certificates from `certs/` directory)
- **Secure WebSocket**: `wss://localhost:8084`

## Project Structure

```
MQTTServer/
├── docker/                    # Docker configuration
│   ├── docker-compose.yml     # Main compose file
│   ├── docker-compose.dev.yml # Development overrides
│   ├── .env.example           # Environment template
│   └── services/              # Per-service configs
│       ├── emqx/              # EMQX broker config
│       ├── influxdb/          # InfluxDB init scripts
│       ├── prometheus/        # Prometheus config
│       └── grafana/           # Grafana dashboards
├── config/                    # Application config
│   ├── users.json             # Authentication data
│   ├── devices.json           # Device registry
│   └── rules/                 # EMQX rules definitions
├── scripts/                   # Utility scripts
│   ├── generate-certs.sh      # TLS certificate generation
│   ├── wait-for-services.sh   # Health check script
│   ├── seed-devices.sh        # Device registry setup
│   └── replay-messages.sh     # Message replay utility
├── tests/                     # Test suites
│   ├── integration/           # Integration tests
│   ├── load/                  # k6 load tests
│   └── fixtures/              # Test data and mocks
└── specs/                     # Design documentation
    └── 001-mqtt-test-ecosystem/
```

## Running Tests

```bash
# Run basic connectivity test
./tests/integration/test_basic_connectivity.sh

# Run all integration tests
for test in tests/integration/test_*.sh; do
    echo "Running $test..."
    bash "$test"
done

# Run load tests (requires k6)
k6 run tests/load/k6-connection-test.js
k6 run tests/load/k6-throughput-test.js
```

## Configuration

All configuration is done through environment variables. Copy `.env.example` to `.env` and customize:

```bash
# Key settings
EMQX_RATE_LIMIT_CONN_PER_SEC=100  # Connections per second per IP
EMQX_MAX_PAYLOAD_SIZE=262144      # Max message size (256KB)
INFLUXDB_RETENTION=24h            # Message retention period
```

See [docker/.env.example](docker/.env.example) for all available options.

## Development

Use the development compose file for additional debug features:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d
```

This exposes additional ports and enables debug logging.

## License

MIT
