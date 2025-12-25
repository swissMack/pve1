# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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