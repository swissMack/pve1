<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoginPage from './components/LoginPage.vue'
import Dashboard from './components/Dashboard.vue'

// User type definition
interface User {
  username: string
  name: string
  role: string
  email: string
}

const isAuthenticated = ref(false)
const currentUser = ref<User | null>(null)

onMounted(() => {
  const authStatus = localStorage.getItem('sim-portal-auth')
  const storedUser = localStorage.getItem('sim-portal-user')
  if (authStatus === 'authenticated' && storedUser) {
    isAuthenticated.value = true
    currentUser.value = JSON.parse(storedUser)
  }
})

const handleLogin = (authenticated: boolean, user?: User) => {
  isAuthenticated.value = authenticated
  if (authenticated && user) {
    currentUser.value = user
    localStorage.setItem('sim-portal-auth', 'authenticated')
    localStorage.setItem('sim-portal-user', JSON.stringify(user))
  }
}

const handleLogout = () => {
  isAuthenticated.value = false
  currentUser.value = null
  localStorage.removeItem('sim-portal-auth')
  localStorage.removeItem('sim-portal-user')
}
</script>

<template>
  <div id="app">
    <LoginPage v-if="!isAuthenticated" :onLogin="handleLogin" />
    <Dashboard v-else :onLogout="handleLogout" :currentUser="currentUser" />
  </div>
</template>

<style>
#app {
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}
</style>
