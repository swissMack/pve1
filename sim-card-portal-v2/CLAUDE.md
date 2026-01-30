# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment Policy

**Deployment target: localhost only.** Do NOT deploy to upcloud, upcloudBSS, or any remote server until further notice. All builds and testing should be done locally via Docker Compose.

## Essential Commands

### Development
- `npm run dev` - Start development server at http://localhost:5173 with HMR
- `npm run build` - Build for production (includes TypeScript compilation)
- `npm run preview` - Preview production build locally

### Common Development Tasks
- Install dependencies: `npm install`
- Check TypeScript errors: `vue-tsc -b` (runs automatically during build)

## Architecture Overview

**Tech Stack**: Vue 3 + TypeScript + Vite + Vercel deployment

### Key Architecture Points
- **Vue 3 Composition API** with `<script setup>` syntax
- **Strict TypeScript** configuration with comprehensive type checking
- **Vite build system** with fast HMR and optimized production builds
- **Single Page Application** currently showing a welcome page

### Project Structure
- `src/App.vue` - Main application component (currently the welcome page)
- `src/main.ts` - Application entry point
- `src/components/` - Vue components directory
- `src/assets/` - Static assets (images, icons)
- `src/style.css` - Global styles with modern CSS features
- `docs/` - Project documentation

### Configuration Files
- `vite.config.ts` - Vite configuration with Vue plugin
- `tsconfig.*.json` - TypeScript configurations (strict mode enabled)
- `vercel.json` - Vercel deployment settings (auto-deploys from main branch)

## Development Context

This is a **SIM Card Portal v2** project with complete authentication and management features. Currently has:
- **Authentication system** with hardcoded admin login (admin/1234567)
- **Dashboard home page** with statistics and quick actions
- **Device Management** page with sortable table (10 attributes per device)
- **SIM Card Management** page with usage tracking and status management
- Swiss design 2024 principles throughout
- Navigation system with 3 main sections

### Authentication Flow
1. Login page (Swiss design) with admin/1234567 credentials
2. Dashboard with navigation and real-time statistics
3. Persistent authentication using localStorage

### Main Features
- **Device List**: Table with filtering, sorting, search (ID, name, status, SIM card, type, location, last seen, signal strength, data usage, connection type)
- **SIM Management**: Usage tracking, carrier management, expiry monitoring, activation controls
- **Dashboard**: Overview statistics and quick action cards

## Code Style
- Use TypeScript for all new code
- Follow Vue 3 Composition API patterns
- Maintain responsive design principles
- Use modern CSS features (CSS Grid, Flexbox, custom properties)

## Proxmox Deployment (192.168.1.59)

### Server Access
- **Host**: 192.168.1.59 (hostname: pve)
- **SSH User**: root
- **SSH Password**: edw4rd9O

### Project Locations on Proxmox
| Project | Path |
|---------|------|
| sim-card-portal-v2 | `/opt/projects/sim-card-portal-v2` |
| mqtt-control-panel | `/opt/projects/MQTTServer/tools/mqtt-control-panel` |
| MQTTServer (ecosystem) | `/opt/projects/MQTTServer` |

### Running Containers
| Container | Port | Purpose |
|-----------|------|---------|
| simcard-portal-api | 3001 | Node.js API server |
| simcard-portal-frontend | 8080 | Nginx serving Vue.js SPA |
| mqtt-control-panel | 5174 | Nginx serving control panel |
| simcard-portal-db | 5434 | PostgreSQL database |

### Deployment Commands

#### 1. Sync source files to Proxmox
```bash
# sim-card-portal-v2 API
sshpass -p 'edw4rd9O' rsync -avz --relative \
  api/ src/ scripts/ \
  root@192.168.1.59:/opt/projects/sim-card-portal-v2/

# mqtt-control-panel
sshpass -p 'edw4rd9O' rsync -avz \
  /Users/mackmood/pve1/tools/mqtt-control-panel/src/ \
  root@192.168.1.59:/opt/projects/MQTTServer/tools/mqtt-control-panel/src/
```

#### 2. Build on Proxmox
```bash
# SSH to server
sshpass -p 'edw4rd9O' ssh root@192.168.1.59

# Build sim-card-portal-v2
cd /opt/projects/sim-card-portal-v2
npm run api:build  # TypeScript API
npm run build       # Frontend

# Build mqtt-control-panel
cd /opt/projects/MQTTServer/tools/mqtt-control-panel
npm run build
```

#### 3. Restart Docker containers
```bash
# Rebuild and restart API (picks up new api-server-docker.js)
cd /opt/projects/sim-card-portal-v2
docker compose stop api && docker compose rm -f api
docker compose build api && docker compose up -d api

# Restart frontend (static files, no rebuild needed)
docker restart simcard-portal-frontend

# Restart mqtt-control-panel (static files via nginx)
docker restart mqtt-control-panel
```

### Docker Architecture
- **sim-card-portal-v2**: Uses `docker compose` with custom images
  - API: Built from `docker/Dockerfile.api`, runs `scripts/api-server-docker.js`
  - Frontend: Built from `docker/Dockerfile.frontend`, nginx serving `dist/`
- **mqtt-control-panel**: Simple `nginx:alpine` container with bind mounts
  - Mounts: `/opt/projects/MQTTServer/tools/mqtt-control-panel/dist` → `/usr/share/nginx/html`

### Important Files for Deployment
| File | Purpose |
|------|---------|
| `scripts/api-server-docker.js` | Standalone API server for Docker (not TypeScript) |
| `docker/Dockerfile.api` | API container build instructions |
| `docker/Dockerfile.frontend` | Frontend container build instructions |
| `docker-compose.yml` | Service orchestration |

### Accessing the Deployed Apps
- **SIM Card Portal**: http://192.168.1.59:8080
- **Portal API**: http://192.168.1.59:3001
- **MQTT Control Panel**: http://192.168.1.59:5174