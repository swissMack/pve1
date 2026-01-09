<script setup>
import Card from 'primevue/card'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Calendar from 'primevue/calendar'
import Slider from 'primevue/slider'
import Button from 'primevue/button'

const props = defineProps({
  settings: { type: Object, required: true },
  canGenerate: { type: Boolean, default: false }
})

const emit = defineEmits(['update:settings', 'generate'])

const updateField = (field, value) => {
  emit('update:settings', { ...props.settings, [field]: value })
}

const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}
</script>

<template>
  <Card class="usage-generator">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-cog"></i>
        <span>Generator Settings</span>
      </div>
    </template>
    <template #content>
      <!-- Record count -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">Records to Generate</label>
        <InputNumber
          :modelValue="settings.recordCount"
          @update:modelValue="updateField('recordCount', $event)"
          :min="1"
          :max="1000"
          showButtons
          class="w-full"
        />
      </div>

      <!-- Period range -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">Period Date Range</label>
        <div class="flex gap-2 align-items-center">
          <Calendar
            :modelValue="settings.periodStart"
            @update:modelValue="updateField('periodStart', $event)"
            dateFormat="yy-mm-dd"
            class="flex-1"
            placeholder="Start date"
          />
          <span class="text-500">to</span>
          <Calendar
            :modelValue="settings.periodEnd"
            @update:modelValue="updateField('periodEnd', $event)"
            dateFormat="yy-mm-dd"
            class="flex-1"
            placeholder="End date"
          />
        </div>
      </div>

      <!-- Hour range -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">Hour Range: {{ String(settings.hourStart).padStart(2, '0') }}:00 - {{ String(settings.hourEnd).padStart(2, '0') }}:59</label>
        <div class="flex gap-2">
          <InputNumber
            :modelValue="settings.hourStart"
            @update:modelValue="updateField('hourStart', $event)"
            :min="0"
            :max="settings.hourEnd"
            showButtons
            class="flex-1"
            placeholder="Start hour"
            suffix=":00"
          />
          <InputNumber
            :modelValue="settings.hourEnd"
            @update:modelValue="updateField('hourEnd', $event)"
            :min="settings.hourStart"
            :max="23"
            showButtons
            class="flex-1"
            placeholder="End hour"
            suffix=":59"
          />
        </div>
        <small class="text-400">Constrains generated timestamps to this hour window (24h format)</small>
      </div>

      <!-- Bytes range -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">
          Bytes Range: {{ formatBytes(settings.bytesMin) }} - {{ formatBytes(settings.bytesMax) }}
        </label>
        <div class="flex gap-2">
          <InputNumber
            :modelValue="settings.bytesMin"
            @update:modelValue="updateField('bytesMin', $event)"
            :min="1024"
            :max="settings.bytesMax - 1024"
            :step="1024 * 1024"
            class="flex-1"
            placeholder="Min bytes"
          />
          <InputNumber
            :modelValue="settings.bytesMax"
            @update:modelValue="updateField('bytesMax', $event)"
            :min="settings.bytesMin + 1024"
            :max="10 * 1024 * 1024 * 1024"
            :step="1024 * 1024"
            class="flex-1"
            placeholder="Max bytes"
          />
        </div>
      </div>

      <!-- Upload ratio -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">
          Upload Ratio: {{ Math.round(settings.uploadRatio * 100) }}% upload / {{ Math.round((1 - settings.uploadRatio) * 100) }}% download
        </label>
        <Slider
          :modelValue="settings.uploadRatio * 100"
          @update:modelValue="updateField('uploadRatio', $event / 100)"
          :min="0"
          :max="100"
          class="w-full"
        />
      </div>

      <!-- SMS range -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">SMS Count Range</label>
        <div class="flex gap-2">
          <InputNumber
            :modelValue="settings.smsMin"
            @update:modelValue="updateField('smsMin', $event)"
            :min="0"
            :max="settings.smsMax"
            class="flex-1"
            placeholder="Min SMS"
          />
          <InputNumber
            :modelValue="settings.smsMax"
            @update:modelValue="updateField('smsMax', $event)"
            :min="settings.smsMin"
            :max="10000"
            class="flex-1"
            placeholder="Max SMS"
          />
        </div>
      </div>

      <!-- Source identifier -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">Source Identifier</label>
        <InputText
          :modelValue="settings.source"
          @update:modelValue="updateField('source', $event)"
          placeholder="mqtt-simulator"
          class="w-full"
        />
      </div>

      <!-- Generate button -->
      <Button
        icon="pi pi-bolt"
        label="Generate Records"
        @click="emit('generate')"
        :disabled="!canGenerate"
        class="w-full"
        severity="success"
      />
      <small v-if="!canGenerate" class="block text-orange-500 mt-2 text-center">
        Add ICCIDs to the SIM Pool first
      </small>
    </template>
  </Card>
</template>

<style scoped>
.usage-generator :deep(.p-card-content) {
  padding-top: 0;
}
</style>
