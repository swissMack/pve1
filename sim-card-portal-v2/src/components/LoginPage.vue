<script setup lang="ts">
import { ref } from 'vue'

// User type definition
interface User {
  username: string
  name: string
  role: string
  email: string
}

interface LoginProps {
  onLogin: (isAuthenticated: boolean, user?: User) => void
}

const props = defineProps<LoginProps>()

// User credentials database
const userCredentials: Record<string, { password: string; user: User }> = {
  'admin': {
    password: '1234567',
    user: { username: 'admin', name: 'Admin User', role: 'Super Admin', email: 'admin@ioto.com' }
  },
  'FMP': {
    password: 'fmp123',
    user: { username: 'FMP', name: 'FMP User', role: 'FMP', email: 'fmp@ioto.com' }
  },
  'DMP': {
    password: 'dmp123',
    user: { username: 'DMP', name: 'DMP User', role: 'DMP', email: 'dmp@ioto.com' }
  },
  'CMP': {
    password: 'cmp123',
    user: { username: 'CMP', name: 'CMP User', role: 'CMP', email: 'cmp@ioto.com' }
  }
}

const username = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)
const showPassword = ref(false)

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true

  await new Promise(resolve => setTimeout(resolve, 800))

  const userEntry = userCredentials[username.value]
  if (userEntry && userEntry.password === password.value) {
    props.onLogin(true, userEntry.user)
  } else {
    error.value = 'Invalid credentials. Please try again.'
    password.value = ''
  }

  isLoading.value = false
}

const handleSubmit = (e: Event) => {
  e.preventDefault()
  handleLogin()
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="relative flex min-h-screen w-full flex-row overflow-hidden bg-background-dark">
    <!-- Left Side: Branding / Visual (Hidden on mobile, visible on desktop) -->
    <div
      class="hidden lg:flex lg:w-1/2 relative flex-col justify-end bg-cover bg-center"
      style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuB1HQOvIod30FULouj37XdHVU6nZ4qQ1IwowGI7VJT762NicDWJ4jywhfAos-7Ll0j8Mv7BY_6S5LzLFw_1DkDetIBjcyyyZjCmMaOJ7HwIMfhxxukp0nI5m6WhB93rumky-xVaNNXsKBIXSDWp3NIhot3G7h_KK8_U6FIx4-MsDa6O-ARRFVdUNi4wIfqNXRh5e6_Q857kz8Tm9roMhEhxaY2jIeXhpqzPAi1izwKo3C175JrPII_IpOaKOmjLAbe57P9YaHT1VpY');"
    >
      <!-- Gradient Overlay for text readability -->
      <div class="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent opacity-90"></div>
      <div class="relative z-10 p-12 xl:p-16 flex flex-col gap-6">
        <div class="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30">
          <span class="material-symbols-outlined text-primary text-3xl">hub</span>
        </div>
        <div class="max-w-[480px] flex flex-col gap-2">
          <h1 class="text-white tracking-tight text-4xl font-bold leading-tight">IoTo</h1>
          <p class="text-gray-300 text-lg font-medium leading-relaxed">
            Secure, real-time access to your global SIM & Device fleet. Monitor connectivity, manage data usage, and deploy updates from a single pane of glass.
          </p>
        </div>
        <!-- Security Badge -->
        <div class="flex items-center gap-2 mt-4 text-sm text-gray-400">
          <span class="material-symbols-outlined text-lg">lock</span>
          <span>End-to-end encrypted session (TLS 1.3)</span>
        </div>
      </div>
    </div>

    <!-- Right Side: Login Form -->
    <div class="flex flex-1 flex-col justify-center items-center w-full lg:w-1/2 px-4 sm:px-6 lg:px-20 xl:px-24 bg-background-dark relative">
      <!-- Mobile Header (Visible only on small screens) -->
      <div class="lg:hidden absolute top-6 left-6 flex items-center gap-2">
        <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-2xl">hub</span>
        </div>
        <span class="font-bold text-xl text-white">IoTo</span>
      </div>

      <div class="w-full max-w-[440px] flex flex-col gap-8">
        <!-- Form Header -->
        <div class="flex flex-col gap-2">
          <h2 class="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
          <p class="text-text-secondary text-base">
            Please enter your credentials to access the dashboard.
          </p>
        </div>

        <!-- Form Fields -->
        <form @submit="handleSubmit" class="flex flex-col gap-5">
          <!-- Username Field -->
          <label class="flex flex-col gap-1.5">
            <p class="text-white text-sm font-medium leading-normal">Username</p>
            <div class="relative">
              <input
                v-model="username"
                autocomplete="username"
                class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary border-none bg-surface-dark h-12 placeholder:text-text-secondary px-4 text-base font-normal leading-normal shadow-sm"
                placeholder="Enter your username"
                type="text"
                :disabled="isLoading"
              />
              <div class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                <span class="material-symbols-outlined text-[20px]">person</span>
              </div>
            </div>
          </label>

          <!-- Password Field -->
          <label class="flex flex-col gap-1.5">
            <div class="flex justify-between items-center">
              <p class="text-white text-sm font-medium leading-normal">Password</p>
              <a class="text-primary text-sm font-medium hover:underline hover:text-primary/80 transition-colors cursor-pointer">Forgot Password?</a>
            </div>
            <div class="relative">
              <input
                v-model="password"
                autocomplete="current-password"
                class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-2 focus:ring-primary border-none bg-surface-dark h-12 placeholder:text-text-secondary px-4 text-base font-normal leading-normal shadow-sm"
                placeholder="Enter your password"
                :type="showPassword ? 'text' : 'password'"
                :disabled="isLoading"
              />
              <div
                @click="togglePassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary cursor-pointer hover:text-white transition-colors"
              >
                <span class="material-symbols-outlined text-[20px]">{{ showPassword ? 'visibility' : 'visibility_off' }}</span>
              </div>
            </div>
          </label>

          <!-- Error Message -->
          <div v-if="error" class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary hover:bg-primary/90 transition-all text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-primary/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading || !username || !password"
          >
            <span v-if="isLoading" class="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            <span class="truncate">{{ isLoading ? 'Authenticating...' : 'Log In' }}</span>
          </button>
        </form>

        <!-- Footer / Support -->
        <div class="flex flex-col gap-4 mt-4">
          <p class="text-text-secondary text-sm text-center">
            Don't have an account? <a class="text-white font-medium underline decoration-1 underline-offset-2 hover:text-primary transition-colors cursor-pointer">Contact Support</a> to request access.
          </p>
        </div>
      </div>

      <!-- Bottom Copyright -->
      <div class="absolute bottom-6 w-full text-center">
        <p class="text-text-secondary/60 text-xs">
          &copy; 2024 IoTo. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Animation for loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
