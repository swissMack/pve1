<script setup>
import HealthCheck from './testing/HealthCheck.vue'
import ApiConsole from './testing/ApiConsole.vue'
</script>

<template>
  <div class="testing-view">
    <h2 class="view-title mb-4">
      <i class="pi pi-cog mr-2"></i>
      API Testing
    </h2>

    <div class="grid">
      <div class="col-12 md:col-6 lg:col-4">
        <HealthCheck />
      </div>
      <div class="col-12 md:col-6 lg:col-8">
        <ApiConsole />
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-title {
  display: flex;
  align-items: center;
  color: #4fc3f7;
  font-size: 1.5rem;
  font-weight: 600;
}
</style>
