<script setup lang="ts">
import Navigation from '@/components/common/Navigation.vue'
import Toast from 'primevue/toast'
</script>

<template>
  <div class="app-container p-4">
    <header class="mb-4">
      <h1 class="text-2xl font-bold text-primary m-0">Billing & Provisioning Dashboard</h1>
    </header>
    <Navigation />
    <main>
      <RouterView />
    </main>
    <Toast />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

.app-container {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
