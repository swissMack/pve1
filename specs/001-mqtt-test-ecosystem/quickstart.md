# Quickstart: MQTT Test Ecosystem

Get the MQTT test ecosystem running in under 5 minutes.

## Prerequisites

- Docker Desktop 4.x+ (or Docker Engine 20.10+ with Docker Compose v2)
- 2GB available RAM
- Ports available: 1883, 8883, 8083, 8084, 3000, 8086, 9090, 18083

## 1. Start the Ecosystem

```bash
# Clone and navigate to project
cd MQTTServer

# Start all services
docker compose up -d

# Verify services are running
docker compose ps
```

Expected output:
```
NAME                STATUS          PORTS
mqtt-emqx           running         0.0.0.0:1883->1883/tcp, 0.0.0.0:8883->8883/tcp, ...
mqtt-influxdb       running         0.0.0.0:8086->8086/tcp
mqtt-grafana        running         0.0.0.0:3000->3000/tcp
mqtt-prometheus     running         0.0.0.0:9090->9090/tcp
```

## 2. Verify Broker Health

```bash
# Check liveness
curl http://localhost:18083/api/v5/health/live

# Check readiness
curl http://localhost:18083/api/v5/health/ready
```

## 3. Connect Your First Client

### Using mosquitto CLI

```bash
# Subscribe to a topic (Terminal 1)
mosquitto_sub -h localhost -p 1883 -t "test/hello"

# Publish a message (Terminal 2)
mosquitto_pub -h localhost -p 1883 -t "test/hello" -m "Hello MQTT!"
```

### Using MQTTX GUI

1. Download [MQTTX](https://mqttx.app/)
2. Create new connection:
   - Host: `localhost`
   - Port: `1883`
   - Protocol: `mqtt://`
3. Subscribe to `test/#`
4. Publish to `test/hello`

## 4. Access Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| EMQX Dashboard | http://localhost:18083 | admin / public |
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| InfluxDB | http://localhost:8086 | admin / admin123 |

## 5. Test MQTT 5.0 Features

### Shared Subscriptions

```bash
# Start two consumers in shared group
mosquitto_sub -h localhost -p 1883 -t '$share/workers/jobs/#' -V 5 &
mosquitto_sub -h localhost -p 1883 -t '$share/workers/jobs/#' -V 5 &

# Publish messages - they'll be load-balanced
for i in {1..10}; do
  mosquitto_pub -h localhost -p 1883 -t "jobs/task" -m "Task $i" -V 5
done
```

### Message Expiry

```bash
# Publish with 60-second expiry
mosquitto_pub -h localhost -p 1883 -t "ephemeral/data" \
  -m "This expires in 60s" -V 5 \
  -D PUBLISH message-expiry-interval 60
```

## 6. Test TLS Connection

```bash
# Generate certificates (first time only)
./scripts/generate-certs.sh

# Connect with TLS
mosquitto_sub -h localhost -p 8883 \
  --cafile certs/ca.crt \
  -t "secure/topic"
```

## 7. Test Authentication

```bash
# Connect with username/password
mosquitto_pub -h localhost -p 1883 \
  -u "testuser" -P "testpass" \
  -t "auth/test" -m "Authenticated!"
```

## Quick Command Reference

| Task | Command |
|------|---------|
| Start ecosystem | `docker compose up -d` |
| Stop ecosystem | `docker compose down` |
| View logs | `docker compose logs -f emqx` |
| Restart broker | `docker compose restart emqx` |
| Check stats | `curl http://localhost:18083/api/v5/stats` |
| List clients | `curl http://localhost:18083/api/v5/clients` |

## Troubleshooting

### Broker won't start
```bash
# Check logs
docker compose logs emqx

# Verify port availability
lsof -i :1883
```

### Can't connect
```bash
# Test TCP connectivity
nc -zv localhost 1883

# Check firewall (macOS)
sudo pfctl -s rules
```

### High memory usage
```bash
# Check connection count
curl http://localhost:18083/api/v5/stats | jq '.connections.count'

# Restart with fresh state
docker compose down -v && docker compose up -d
```

## Next Steps

- Read the [API Documentation](contracts/)
- Configure [Authentication](../docker/services/emqx/acl.conf)
- Set up [Message Persistence](../docker/services/influxdb/)
- Create [Rules](http://localhost:18083/#/rules) in EMQX Dashboard

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMQX_DASHBOARD_USER` | admin | Dashboard username |
| `EMQX_DASHBOARD_PASSWORD` | public | Dashboard password |
| `MQTT_TCP_PORT` | 1883 | MQTT TCP port |
| `MQTT_TLS_PORT` | 8883 | MQTT TLS port |
| `MQTT_WS_PORT` | 8083 | MQTT WebSocket port |
| `MQTT_WSS_PORT` | 8084 | MQTT Secure WebSocket port |
| `INFLUXDB_ADMIN_USER` | admin | InfluxDB username |
| `INFLUXDB_ADMIN_PASSWORD` | admin123 | InfluxDB password |
| `GRAFANA_ADMIN_USER` | admin | Grafana username |
| `GRAFANA_ADMIN_PASSWORD` | admin | Grafana password |
| `MESSAGE_RETENTION_HOURS` | 24 | Message history retention |
| `RATE_LIMIT_PER_IP` | 100 | Connections/sec per IP |
