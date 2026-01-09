<script setup>
import { ref } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Panel from 'primevue/panel'

const props = defineProps({
  config: { type: Object, required: true },
  connectionStatus: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:config', 'test-portal', 'test-analytics'])

const testing = ref({ portal: false, analytics: false })

const updateField = (field, value) => {
  emit('update:config', { ...props.config, [field]: value })
}

const testPortal = async () => {
  testing.value.portal = true
  emit('test-portal')
  setTimeout(() => { testing.value.portal = false }, 1000)
}

const testAnalytics = async () => {
  testing.value.analytics = true
  emit('test-analytics')
  setTimeout(() => { testing.value.analytics = false }, 1000)
}

const getStatusSeverity = (status) => {
  if (status === 'connected') return 'success'
  if (status === 'error') return 'danger'
  return 'secondary'
}

const getStatusLabel = (status) => {
  if (status === 'connected') return 'Connected'
  if (status === 'error') return 'Error'
  return 'Not tested'
}
</script>

<template>
  <Panel header="Connection Settings" toggleable collapsed class="connection-settings">
    <div class="grid">
      <!-- Portal URL -->
      <div class="col-12 md:col-4">
        <label class="block text-500 mb-2">Portal API URL</label>
        <div class="flex gap-2">
          <InputText
            :modelValue="config.portalUrl"
            @update:modelValue="updateField('portalUrl', $event)"
            placeholder="http://localhost:5173"
            class="flex-1"
          />
          <Button
            icon="pi pi-sync"
            :loading="testing.portal"
            @click="testPortal"
            v-tooltip="'Test connection'"
            outlined
          />
          <Tag
            :severity="getStatusSeverity(connectionStatus.portal)"
            :value="getStatusLabel(connectionStatus.portal)"
          />
        </div>
      </div>

      <!-- Analytics URL -->
      <div class="col-12 md:col-4">
        <label class="block text-500 mb-2">Analytics API URL</label>
        <div class="flex gap-2">
          <InputText
            :modelValue="config.analyticsUrl"
            @update:modelValue="updateField('analyticsUrl', $event)"
            placeholder="http://localhost:9010"
            class="flex-1"
          />
          <Button
            icon="pi pi-sync"
            :loading="testing.analytics"
            @click="testAnalytics"
            v-tooltip="'Test connection'"
            outlined
          />
          <Tag
            :severity="getStatusSeverity(connectionStatus.analytics)"
            :value="getStatusLabel(connectionStatus.analytics)"
          />
        </div>
      </div>

      <!-- API Key -->
      <div class="col-12 md:col-4">
        <label class="block text-500 mb-2">API Key</label>
        <Password
          :modelValue="config.apiKey"
          @update:modelValue="updateField('apiKey', $event)"
          placeholder="Enter API key"
          :feedback="false"
          toggleMask
          class="w-full"
          inputClass="w-full"
        />
      </div>

      <!-- Tenant -->
      <div class="col-12 md:col-6">
        <label class="block text-500 mb-2">Tenant</label>
        <InputText
          :modelValue="config.tenant"
          @update:modelValue="updateField('tenant', $event)"
          placeholder="test-tenant"
          class="w-full"
        />
      </div>

      <!-- Customer -->
      <div class="col-12 md:col-6">
        <label class="block text-500 mb-2">Customer</label>
        <InputText
          :modelValue="config.customer"
          @update:modelValue="updateField('customer', $event)"
          placeholder="test-customer"
          class="w-full"
        />
      </div>
    </div>
  </Panel>
</template>

<style scoped>
.connection-settings :deep(.p-panel-content) {
  padding: 1rem;
}
</style>
