# Quickstart: Billing & Provisioning Dashboard

**Feature**: 002-billing-provisioning-dashboard
**Date**: 2025-12-21

## Prerequisites

Before starting development, ensure you have:

1. **Node.js 18+** installed
2. **Billing API server** running at `http://localhost:3001`
   ```bash
   cd /Users/mackmood/CMP/sim-card-portal-v2
   node scripts/local-api-server.js
   ```
3. **API Key** for authenticated endpoints: `test_provisioning_key_12345`

## Project Setup

### 1. Create Vue Project

```bash
cd /Users/mackmood/MQTTServer

# Create dashboard directory
mkdir -p dashboard
cd dashboard

# Initialize Vite + Vue project
npm create vite@latest . -- --template vue-ts

# Install dependencies
npm install

# Install PrimeVue and related packages
npm install primevue primeicons primeflex
npm install axios

# Install dev dependencies
npm install -D vitest @vue/test-utils jsdom @vitejs/plugin-vue
npm install -D playwright @playwright/test
```

### 2. Configure PrimeVue

Update `src/main.ts`:

```typescript
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura
  }
})
app.use(ToastService)
app.use(ConfirmationService)
app.use(router)

app.mount('#app')
```

### 3. Configure Router

Create `src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/billing'
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('@/pages/BillingPage.vue')
  },
  {
    path: '/provisioning',
    name: 'Provisioning',
    component: () => import('@/pages/ProvisioningPage.vue')
  },
  {
    path: '/testing',
    name: 'Testing',
    component: () => import('@/pages/TestingPage.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
```

### 4. Configure Axios

Create `src/services/api.ts`:

```typescript
import axios from 'axios'

const API_BASE = 'http://localhost:3001'
const API_KEY = 'test_provisioning_key_12345'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
})

// Error interceptor
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || error.message
    // Toast will be shown by component
    return Promise.reject({ ...error, displayMessage: message })
  }
)
```

### 5. Configure Vitest

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
})
```

## Project Structure

```text
dashboard/
├── src/
│   ├── components/
│   │   ├── billing/
│   │   │   ├── InvoiceList.vue
│   │   │   ├── MediationEvents.vue
│   │   │   ├── KpiDashboard.vue
│   │   │   └── CarrierBreakdown.vue
│   │   ├── provisioning/
│   │   │   ├── SimList.vue
│   │   │   ├── SimDetails.vue
│   │   │   └── BlockDialog.vue
│   │   ├── testing/
│   │   │   ├── HealthCheck.vue
│   │   │   └── ApiConsole.vue
│   │   └── common/
│   │       ├── Navigation.vue
│   │       ├── ErrorRetry.vue
│   │       └── AutoRefresh.vue
│   ├── composables/
│   │   ├── useAutoRefresh.ts
│   │   ├── useInvoices.ts
│   │   ├── useSims.ts
│   │   ├── useMediationEvents.ts
│   │   └── useKpis.ts
│   ├── pages/
│   │   ├── BillingPage.vue
│   │   ├── ProvisioningPage.vue
│   │   └── TestingPage.vue
│   ├── services/
│   │   ├── api.ts
│   │   ├── billingService.ts
│   │   ├── provisioningService.ts
│   │   └── testingService.ts
│   ├── types/
│   │   ├── invoice.ts
│   │   ├── sim.ts
│   │   ├── mediation.ts
│   │   └── kpi.ts
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   └── composables/
│   └── e2e/
│       ├── billing.spec.ts
│       ├── provisioning.spec.ts
│       └── testing.spec.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── playwright.config.ts
```

## Development Workflow

### TDD Cycle (Required by Constitution)

1. **Write test first**
   ```bash
   # Create test file
   touch src/composables/useInvoices.test.ts
   ```

2. **Run test (should fail - Red)**
   ```bash
   npm run test:unit
   ```

3. **Implement minimum code to pass**

4. **Run test (should pass - Green)**
   ```bash
   npm run test:unit
   ```

5. **Refactor if needed**

### Running the Dashboard

```bash
# Start development server
npm run dev

# Dashboard available at http://localhost:5173
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# E2E tests (requires API server running)
npm run test:e2e

# Watch mode for TDD
npm run test:unit -- --watch
```

## Key Composables

### useAutoRefresh

```typescript
// src/composables/useAutoRefresh.ts
import { onMounted, onUnmounted, ref } from 'vue'

export function useAutoRefresh(fetchFn: () => Promise<void>, interval = 30000) {
  const isRefreshing = ref(false)
  let timer: number | null = null

  const refresh = async () => {
    isRefreshing.value = true
    try {
      await fetchFn()
    } finally {
      isRefreshing.value = false
    }
  }

  onMounted(() => {
    refresh() // Initial fetch
    timer = window.setInterval(refresh, interval)
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
    }
  })

  return { isRefreshing, refresh }
}
```

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/sims` | GET | List SIMs |
| `/api/v1/sims/:id` | GET | Get SIM details |
| `/api/v1/sims/:id/block` | POST | Block SIM |
| `/api/v1/sims/:id/unblock` | POST | Unblock SIM |
| `/api/consumption/invoices` | GET | List invoices |
| `/api/consumption/kpis` | GET | Get KPIs |
| `/api/consumption/trends` | GET | Get trends |
| `/api/consumption/carriers` | GET | Get carrier breakdown |

## Verification Checklist

Before marking setup complete:

- [ ] `npm run dev` starts without errors
- [ ] Can navigate to `/billing`, `/provisioning`, `/testing`
- [ ] API health check succeeds
- [ ] Unit test framework runs
- [ ] E2E test framework configured
