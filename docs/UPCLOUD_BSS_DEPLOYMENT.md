# UpcloudBSS Deployment Documentation

## Overview

This document describes the deployment of the pve1 stack (MQTT ecosystem + SIM Card Portal + MQTT Control Panel) to the upcloudBSS server (94.237.6.75), including HTTPS configuration with Traefik and Let's Encrypt.

**Deployment Date:** January 27, 2026
**Server:** upcloudBSS (94.237.6.75)
**Location:** Netherlands (Amsterdam, nl-ams1)
**Domain:** bob-ventures.com

---

## Server Access

```bash
ssh upcloudBSS
# or
ssh tarik@94.237.6.75 -i ~/.ssh/upcloud
```

**Sudo Password:** `tarik1234`

---

## Architecture

```
                                    ┌─────────────────────────────────────────────┐
                                    │           upcloudBSS (94.237.6.75)          │
                                    │                                             │
    Internet                        │  ┌─────────────────────────────────────┐   │
        │                           │  │         Traefik (Reverse Proxy)     │   │
        │                           │  │         Ports: 80, 443              │   │
        ▼                           │  │         SSL/TLS Termination         │   │
   *.bob-ventures.com               │  └──────────────┬──────────────────────┘   │
        │                           │                 │                           │
        │                           │    ┌────────────┼────────────┐              │
        │                           │    ▼            ▼            ▼              │
        │                           │ ┌──────┐   ┌──────┐   ┌──────────┐          │
        └───────────────────────────┼▶│ ERP  │   │Portal│   │MQTT Panel│          │
                                    │ │:8080 │   │:8081 │   │  :5174   │          │
                                    │ └──────┘   └──────┘   └──────────┘          │
                                    │                                             │
                                    │ ┌──────────────────────────────────────┐   │
                                    │ │          MQTT Ecosystem               │   │
                                    │ │  EMQX, InfluxDB, Grafana, Prometheus │   │
                                    │ └──────────────────────────────────────┘   │
                                    └─────────────────────────────────────────────┘
```

---

## Service URLs (HTTPS)

| Service | URL | Credentials |
|---------|-----|-------------|
| **ERPNext** | https://erp.bob-ventures.com | (existing) |
| **SIM Card Portal** | https://portal.bob-ventures.com | admin / 1234567 |
| **MQTT Control Panel** | https://mqtt-panel.bob-ventures.com | - |
| **Grafana** | https://grafana.bob-ventures.com | admin / admin |
| **EMQX Dashboard** | https://emqx.bob-ventures.com | admin / public |
| **Portainer** | https://portainer.bob-ventures.com | (set on first access) |
| **Traefik Dashboard** | https://traefik.bob-ventures.com | admin / npwpRyk8SBb8t4XR |
| **Prometheus** | https://prometheus.bob-ventures.com | - |
| **InfluxDB** | https://influxdb.bob-ventures.com | admin / npwpRyk8SBb8t4XR |

**MQTT WebSocket (for browser clients):** `wss://mqtt-panel.bob-ventures.com/mqtt`
- Proxied through Traefik to EMQX port 8083
- Used by MQTT Control Panel for real-time MQTT connections

---

## Port Allocation

| Port | Service | Internal Access | Notes |
|------|---------|-----------------|-------|
| 80 | Traefik HTTP | - | Redirects to HTTPS |
| 443 | Traefik HTTPS | - | SSL termination |
| 8080 | ERPNext | http://localhost:8080 | Existing, unchanged |
| 8081 | SIM Card Portal Frontend | http://localhost:8081 | Changed from 8080 |
| 3001 | SIM Card Portal API | http://localhost:3001 | |
| 3002 | MQTT Bridge WebSocket | http://localhost:3002 | |
| 5174 | MQTT Control Panel | http://localhost:5174 | |
| 3003 | MQTT Control Panel API | http://localhost:3003 | |
| 1883 | EMQX MQTT TCP | mqtt://localhost:1883 | |
| 8083 | EMQX MQTT WebSocket | ws://localhost:8083/mqtt | |
| 18083 | EMQX Dashboard | http://localhost:18083 | |
| 8086 | InfluxDB | http://localhost:8086 | |
| 9090 | Prometheus | http://localhost:9090 | |
| 3000 | Grafana | http://localhost:3000 | |
| 9000 | Portainer | http://localhost:9000 | |
| 5433 | PostgreSQL (Portal) | localhost:5433 | External port |

---

## Directory Structure

```
/opt/pve1/
├── traefik/                          # Reverse Proxy
│   ├── docker-compose.yml
│   ├── config/
│   │   ├── traefik.yml               # Static configuration
│   │   └── dynamic/
│   │       └── services.yml          # Route definitions
│   └── certs/
│       └── acme.json                 # Let's Encrypt certificates
│
├── docker/                           # MQTT Ecosystem
│   ├── docker-compose.upcloudBSS.yml
│   ├── .env.upcloudBSS
│   ├── .env                          # Active config (copy of .env.upcloudBSS)
│   └── services/
│       ├── emqx/
│       │   ├── emqx-notls.conf       # EMQX config (no TLS)
│       │   └── acl.conf
│       ├── grafana/
│       │   ├── dashboards/
│       │   └── provisioning/
│       ├── prometheus/
│       │   ├── prometheus.yml
│       │   └── alerts.yml
│       └── influxdb/
│
├── sim-card-portal-v2/               # SIM Card Portal
│   ├── docker-compose.upcloudBSS.yml
│   ├── .env.upcloudBSS
│   ├── .env                          # Active config
│   └── docker/
│       ├── Dockerfile.api
│       ├── Dockerfile.frontend.multistage
│       └── Dockerfile.mqtt-bridge
│
├── mqtt-control-panel/               # MQTT Control Panel
│   ├── docker-compose.upcloudBSS.yml
│   ├── .env.upcloudBSS
│   ├── .env                          # Active config
│   ├── Dockerfile
│   └── Dockerfile.frontend
│
├── scripts/
│   └── simportal-generator/          # Data generator
│
└── config/
    └── simportal-devices.json        # Device configuration
```

---

## Docker Networks

| Network | Purpose | Services |
|---------|---------|----------|
| `traefik-network` | Reverse proxy routing | traefik |
| `mqtt-network` | MQTT ecosystem | emqx, influxdb, grafana, prometheus, portainer, data-generator, mqtt-bridge |
| `simcard-network` | SIM Card Portal | portal-db, portal-api, portal-frontend, mqtt-bridge |
| `mqtt-control-panel_mqtt-control-network` | MQTT Control Panel | control-panel-backend, control-panel-frontend |
| `frappe_docker_default` | ERPNext | frappe services |

---

## Container Management

### View All Containers
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Restart Services

**Traefik (Reverse Proxy):**
```bash
cd /opt/pve1/traefik
docker compose restart
```

**MQTT Ecosystem:**
```bash
cd /opt/pve1/docker
docker compose -f docker-compose.upcloudBSS.yml restart
```

**SIM Card Portal:**
```bash
cd /opt/pve1/sim-card-portal-v2
docker compose -f docker-compose.upcloudBSS.yml restart
```

**MQTT Control Panel:**
```bash
cd /opt/pve1/mqtt-control-panel
docker compose -f docker-compose.upcloudBSS.yml restart
```

### View Logs
```bash
# Traefik
docker logs -f traefik

# SIM Card Portal API
docker logs -f simcard-portal-api

# EMQX
docker logs -f mqtt-emqx

# Any container
docker logs -f <container-name>
```

### Rebuild and Restart
```bash
# Example: Rebuild SIM Card Portal
cd /opt/pve1/sim-card-portal-v2
docker compose -f docker-compose.upcloudBSS.yml up -d --build
```

---

## MQTT Bridge Service

The MQTT Bridge (`simcard-portal-mqtt-bridge`) subscribes to EMQX MQTT topics and persists sensor/location data to PostgreSQL.

### Environment Variables (in docker-compose.upcloudBSS.yml)

| Variable | Value | Purpose |
|----------|-------|---------|
| `MQTT_BROKER_URL` | `mqtt://mqtt-emqx:1883` | EMQX broker address |
| `MQTT_TOPIC_PREFIX` | `simportal/devices` | Topic prefix to subscribe |
| `MQTT_CLIENT_ID` | `simcard-portal-bridge` | Unique client identifier |
| `DB_HOST` | `simcard-portal-db` | PostgreSQL container hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `simportal-secure-password` | Database password |
| `DB_NAME` | `simcardportal` | Database name |
| `USE_PUBLIC_SCHEMA` | `true` | Use public schema |
| `WS_PORT` | `3002` | WebSocket server port |

### Topics Subscribed
- `simportal/devices/+/sensors` - Device sensor data (temperature, humidity, etc.)
- `simportal/devices/+/location` - Device GPS location data

### MQTT Generator Devices
The MQTT data generator sends data for devices `DEV001` through `DEV008`. These devices must exist in the `devices` table with matching IDs for the foreign key constraints to pass.

### Check Bridge Status
```bash
# View logs
docker logs -f simcard-portal-mqtt-bridge

# Check health
docker inspect --format='{{.State.Health.Status}}' simcard-portal-mqtt-bridge

# Verify data is being recorded
docker exec simcard-portal-db psql -U postgres -d simcardportal -c \
  "SELECT COUNT(*) FROM device_sensor_history WHERE recorded_at > NOW() - INTERVAL '1 hour';"
```

---

## SSL/TLS Certificates

### Certificate Provider
- **Provider:** Let's Encrypt
- **Challenge Type:** HTTP-01
- **Auto-Renewal:** Yes (Traefik handles automatically)
- **Validity:** 90 days (renewed at 30 days remaining)

### Certificate Storage
```bash
/opt/pve1/traefik/certs/acme.json
```

### View Issued Certificates
```bash
cat /opt/pve1/traefik/certs/acme.json | jq '.letsencrypt.Certificates[].domain.main'
```

### Force Certificate Renewal
```bash
# Clear certificate cache and restart
docker stop traefik
rm /opt/pve1/traefik/certs/acme.json
touch /opt/pve1/traefik/certs/acme.json
chmod 600 /opt/pve1/traefik/certs/acme.json
docker start traefik
```

---

## DNS Configuration

### DNS Provider
Hostpoint (for bob-ventures.com)

### Required DNS Records
**Option 1: Wildcard Record (Recommended)**
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | * | 94.237.6.75 | 3600 |

**Option 2: Individual Records**
| Type | Name | Value |
|------|------|-------|
| A | erp | 94.237.6.75 |
| A | portal | 94.237.6.75 |
| A | mqtt-panel | 94.237.6.75 |
| A | grafana | 94.237.6.75 |
| A | emqx | 94.237.6.75 |
| A | portainer | 94.237.6.75 |
| A | traefik | 94.237.6.75 |
| A | prometheus | 94.237.6.75 |
| A | influxdb | 94.237.6.75 |

---

## Configuration Files

### Traefik Static Config (`/opt/pve1/traefik/config/traefik.yml`)
```yaml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
  file:
    directory: /etc/traefik/dynamic
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@bob-ventures.com
      storage: /acme.json
      httpChallenge:
        entryPoint: web
```

### MQTT Ecosystem Env (`/opt/pve1/docker/.env.upcloudBSS`)
```env
EMQX_DASHBOARD_USER=admin
EMQX_DASHBOARD_PASS=public
INFLUXDB_USER=admin
INFLUXDB_PASS=npwpRyk8SBb8t4XR
INFLUXDB_ORG=mqtt-org
INFLUXDB_BUCKET=mqtt_messages
INFLUXDB_RETENTION=24h
INFLUXDB_TOKEN=mqtt-influxdb-token
GRAFANA_USER=admin
GRAFANA_PASS=admin
DATA_GEN_SENSOR_INTERVAL=10
DATA_GEN_LOCATION_INTERVAL=5
DATA_GEN_TOPIC_PREFIX=simportal/devices
```

### SIM Card Portal Env (`/opt/pve1/sim-card-portal-v2/.env.upcloudBSS`)
```env
MQTT_BROKER_URL=mqtt://mqtt-emqx:1883
MQTT_CLIENT_ID=simcard-portal-bridge
MQTT_TOPIC_PREFIX=simportal/devices
VITE_MQTT_BROKER_URL=ws://94.237.6.75:8083/mqtt
API_PORT=3001
VITE_USE_API=true
DB_HOST=simcard-portal-db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=simportal-secure-password
DB_NAME=simcardportal
FRONTEND_PORT=8081
```

---

## Frontend Build Variables (IMPORTANT)

The SIM Card Portal and MQTT Control Panel frontends use **Vite**, which bakes environment variables into the JavaScript at **build time**. These `VITE_*` variables are NOT runtime configurable.

### SIM Card Portal Frontend Build Args
Located in `docker-compose.upcloudBSS.yml` under `frontend.build.args`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `https://portal.bob-ventures.com` | API base URL for all fetch requests |
| `VITE_MQTT_BROKER_URL` | `wss://mqtt-panel.bob-ventures.com/mqtt` | WebSocket URL for MQTT |
| `VITE_GRAFANA_URL` | `https://grafana.bob-ventures.com` | Grafana dashboard link |
| `VITE_INFLUXDB_URL` | `https://influxdb.bob-ventures.com` | InfluxDB link |
| `VITE_EMQX_DASHBOARD_URL` | `https://emqx.bob-ventures.com` | EMQX dashboard link |
| `VITE_USE_API` | `true` | Enable API mode (vs mock data) |

### MQTT Control Panel Frontend Build Args
Located in `mqtt-control-panel/docker-compose.upcloudBSS.yml`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_PORTAL_API_URL` | `https://portal.bob-ventures.com/api` | Portal API URL |
| `VITE_MQTT_BROKER_URL` | `wss://mqtt-panel.bob-ventures.com/mqtt` | WebSocket URL for MQTT |
| `VITE_BACKEND_API_URL` | `/api` | Control panel backend (relative path) |
| `VITE_EMQX_DASHBOARD_URL` | `https://emqx.bob-ventures.com` | EMQX dashboard link |
| `VITE_GRAFANA_URL` | `https://grafana.bob-ventures.com` | Grafana link |

### Rebuilding After URL Changes

If you change any `VITE_*` variable, you **must rebuild** the frontend:

```bash
# SIM Card Portal
cd /opt/pve1/sim-card-portal-v2
docker compose -f docker-compose.upcloudBSS.yml build --no-cache frontend
docker compose -f docker-compose.upcloudBSS.yml up -d frontend

# MQTT Control Panel
cd /opt/pve1/mqtt-control-panel
docker compose -f docker-compose.upcloudBSS.yml build --no-cache frontend
docker compose -f docker-compose.upcloudBSS.yml up -d frontend
```

---

## Database Auto-Initialization

The PostgreSQL database automatically initializes on first start using scripts in `/opt/pve1/sim-card-portal-v2/docker/init-db/`:

| Script | Purpose |
|--------|---------|
| `01-schema.sql` | Creates all tables, indexes, and functions |
| `02-sample-data.sql` | Inserts carriers, plans, locations, devices, SIM cards |
| `03-generate-usage-data.sql` | Generates 6 months of usage data with current dates |

**Note:** These scripts only run when the database volume is empty (first start or after `docker compose down -v`).

### Tables for MQTT Data

The `device_sensor_history` and `device_location_history` tables store real-time data from MQTT:

**device_sensor_history columns:**
- `device_id`, `temperature`, `humidity`, `pressure`, `battery_voltage`, `signal_rssi`
- `light`, `battery_level`, `signal_strength`, `metadata`, `recorded_at`

**device_location_history columns:**
- `device_id`, `latitude`, `longitude`, `altitude`, `speed`, `heading`, `accuracy`
- `location_source`, `battery_level`, `signal_strength`, `metadata`, `recorded_at`

### Full Database Reset
```bash
cd /opt/pve1/sim-card-portal-v2
docker compose -f docker-compose.upcloudBSS.yml down -v
docker compose -f docker-compose.upcloudBSS.yml up -d
```

---

## Database

### PostgreSQL (SIM Card Portal)
- **Container:** simcard-portal-db
- **External Port:** 5433
- **Internal Port:** 5432
- **Database:** simcardportal
- **User:** postgres
- **Password:** simportal-secure-password

### Connect to Database
```bash
# From server
docker exec -it simcard-portal-db psql -U postgres -d simcardportal

# From local machine
psql -h 94.237.6.75 -p 5433 -U postgres -d simcardportal
```

### Run Migrations
```bash
docker exec -i simcard-portal-db psql -U postgres -d simcardportal < /opt/pve1/sim-card-portal-v2/migrations/<migration>.sql
```

---

## Troubleshooting

### Check Container Status
```bash
docker ps -a
```

### Check Container Health
```bash
docker inspect --format='{{.State.Health.Status}}' <container-name>
```

### Check Traefik Routing
```bash
# View Traefik dashboard
https://traefik.bob-ventures.com
# Login: admin / npwpRyk8SBb8t4XR
```

### SSL Certificate Issues
```bash
# Check Traefik logs for ACME errors
docker logs traefik 2>&1 | grep -i -E '(error|cert|acme)'

# Verify certificate
curl -vI https://portal.bob-ventures.com 2>&1 | grep -i "subject\|issuer\|expire"
```

### Service Not Accessible
1. Check container is running: `docker ps | grep <service>`
2. Check container logs: `docker logs <container-name>`
3. Check Traefik routing: View Traefik dashboard
4. Check DNS: `nslookup <subdomain>.bob-ventures.com`

### Restart Everything
```bash
# Stop all pve1 services
cd /opt/pve1/traefik && docker compose down
cd /opt/pve1/docker && docker compose -f docker-compose.upcloudBSS.yml down
cd /opt/pve1/sim-card-portal-v2 && docker compose -f docker-compose.upcloudBSS.yml down
cd /opt/pve1/mqtt-control-panel && docker compose -f docker-compose.upcloudBSS.yml down

# Start all services (in order)
cd /opt/pve1/docker && docker compose -f docker-compose.upcloudBSS.yml up -d
cd /opt/pve1/sim-card-portal-v2 && docker compose -f docker-compose.upcloudBSS.yml up -d
cd /opt/pve1/mqtt-control-panel && docker compose -f docker-compose.upcloudBSS.yml up -d
cd /opt/pve1/traefik && docker compose up -d
```

---

## Backup Considerations

### Important Data Volumes
- `mqtt-emqx-data` - EMQX persistent data
- `mqtt-influxdb-data` - Time-series data
- `mqtt-grafana-data` - Dashboards and settings
- `mqtt-prometheus-data` - Metrics history
- `simcard-portal-postgres-data` - Portal database
- `mqtt-portainer-data` - Portainer settings

### Backup Commands
```bash
# Backup PostgreSQL
docker exec simcard-portal-db pg_dump -U postgres simcardportal > backup_$(date +%Y%m%d).sql

# Backup all volumes (example)
docker run --rm -v <volume-name>:/data -v $(pwd):/backup alpine tar czf /backup/<volume-name>.tar.gz /data
```

---

## Security Notes

1. **Change default passwords** for production use:
   - Traefik dashboard: admin/npwpRyk8SBb8t4XR (changed)
   - Grafana: admin/admin
   - EMQX: admin/public
   - InfluxDB: admin/npwpRyk8SBb8t4XR (changed)

2. **Firewall:** Consider restricting direct port access (8081, 3001, etc.) and only allow 80/443 through Traefik

3. **Database:** PostgreSQL is exposed on port 5433 - consider restricting access

4. **SSL:** Certificates auto-renew, but monitor for any issues

---

## Related Documentation

- [SIM Card Portal CLAUDE.md](/Users/mackmood/pve1/sim-card-portal-v2/CLAUDE.md)
- [MQTT Ecosystem CLAUDE.md](/Users/mackmood/pve1/CLAUDE.md)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Let's Encrypt](https://letsencrypt.org/docs/)
