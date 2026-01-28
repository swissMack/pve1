# MQTTServer Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-14

## Active Technologies
- TypeScript 5.3, Vue 3.4 + Vue 3, PrimeVue 4, Axios, Vue Router (002-billing-provisioning-dashboard)
- N/A (consumes external API, no local persistence) (002-billing-provisioning-dashboard)
- TypeScript 5.8, Vue 3.5 + PrimeVue 4.x, Chart.js 4.5, Supabase, Vite 7 (003-consumption-filters-llm)
- Session storage for filter state and API response caching; Supabase for persistent data (003-consumption-filters-llm)

- (001-mqtt-test-ecosystem)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for 

## Code Style

: Follow standard conventions

## Recent Changes
- 003-consumption-filters-llm: Added TypeScript 5.8, Vue 3.5 + PrimeVue 4.x, Chart.js 4.5, Supabase, Vite 7
- 003-consumption-filters-llm: Added TypeScript 5.8, Vue 3.5 + PrimeVue 4.x, Chart.js 4.5, Supabase, Vite 7
- 002-billing-provisioning-dashboard: Added TypeScript 5.3, Vue 3.4 + Vue 3, PrimeVue 4, Axios, Vue Router


<!-- MANUAL ADDITIONS START -->

## Git Repositories

- **Primary:** https://github.com/ioto-communications/pve1
- **Mirror:** https://github.com/swissMack/pve1

Both repos should be kept in sync.

## Deployment - upcloudBSS

- **Server:** 94.237.6.75 (ssh upcloudBSS)
- **Location:** Netherlands (Amsterdam, nl-ams1)
- **User:** tarik

### Deployed Services

| Service | Path | Container |
|---------|------|-----------|
| SIM Card Portal API | /opt/pve1/sim-card-portal-v2 | simcard-portal-api |
| SIM Card Portal Frontend | /opt/pve1/sim-card-portal-v2 | simcard-portal-frontend |
| SIM Card Portal DB | /opt/pve1/sim-card-portal-v2 | simcard-portal-db |
| MQTT Control Panel | /opt/pve1/mqtt-control-panel | mqtt-control-panel-frontend/backend |

### URLs (via Traefik)

- Portal: https://portal.bob-ventures.com
- MQTT Panel: https://mqtt-panel.bob-ventures.com
- Grafana: https://grafana.bob-ventures.com
- EMQX: https://emqx.bob-ventures.com
- ERPNext: https://erp.bob-ventures.com

### Database

- PostgreSQL container: simcard-portal-db
- Database: simcardportal
- Schema: public (USE_PUBLIC_SCHEMA=true)

### Notes

- After rebuilding API container, reconnect to traefik-network: `docker network connect traefik-network simcard-portal-api`
- VITE_PORTAL_API_URL must be set as build arg for MQTT Control Panel frontend

<!-- MANUAL ADDITIONS END -->
