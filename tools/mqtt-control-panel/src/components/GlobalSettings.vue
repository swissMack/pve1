<script setup>
import { ref } from 'vue'
import Panel from 'primevue/panel'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'

const props = defineProps({
  connected: Boolean
})

const emit = defineEmits(['update-location-interval'])

const locationInterval = ref(5)

function applyLocationInterval() {
  emit('update-location-interval', locationInterval.value)
}
</script>

<template>
  <Panel header="Global Settings" class="global-settings">
    <div class="settings-grid">
      <div class="setting-item">
        <label>Location Interval (seconds)</label>
        <div class="slider-group">
          <Slider v-model="locationInterval" :min="1" :max="60" :step="1" class="flex-1" />
          <InputNumber v-model="locationInterval" :min="1" :max="60" :showButtons="false" class="interval-input" />
        </div>
      </div>

      <div class="setting-item button-item">
        <Button
          label="Apply"
          icon="pi pi-check"
          :disabled="!connected"
          @click="applyLocationInterval"
          severity="success"
        />
      </div>
    </div>
  </Panel>
</template>

<style scoped>
.global-settings {
  margin-bottom: 1.5rem;
}

.settings-grid {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.setting-item {
  flex: 1;
  min-width: 200px;
}

.setting-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.button-item {
  flex: 0;
  min-width: auto;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.flex-1 {
  flex: 1;
}

.interval-input {
  width: 70px;
}

.interval-input :deep(.p-inputnumber-input) {
  width: 70px;
  text-align: center;
}
</style>
