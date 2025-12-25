import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'

// Import WebSocket service for real-time device updates
import websocketService from './services/websocketService'

const app = createApp(App)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.p-dark',
      cssLayer: false
    }
  }
})
app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)
app.mount('#app')

// Initialize WebSocket connection for real-time updates (non-blocking)
// Connection will be established in the background
const wsUrl = import.meta.env.VITE_WEBSOCKET_URL
if (wsUrl) {
  websocketService.connect(wsUrl).catch((err) => {
    console.warn('WebSocket connection failed (real-time updates unavailable):', err.message)
  })
}
