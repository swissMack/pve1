<script setup lang="ts">
import HealthCheck from '@/components/testing/HealthCheck.vue'
import ApiConsole from '@/components/testing/ApiConsole.vue'
</script>

<template>
  <div class="testing-page">
    <h2 class="text-xl font-semibold mb-4">Testing</h2>

    <div class="grid">
      <div class="col-12 lg:col-6">
        <HealthCheck />
      </div>
      <div class="col-12 lg:col-6">
        <ApiConsole />
      </div>
    </div>
  </div>
</template>
