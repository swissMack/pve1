<script setup>
import { useMediation } from '../composables/useMediation.js'
import ConnectionSettings from './mediation/ConnectionSettings.vue'
import SimPoolManager from './mediation/SimPoolManager.vue'
import UsageGenerator from './mediation/UsageGenerator.vue'
import SubmissionPanel from './mediation/SubmissionPanel.vue'
import SubmissionHistory from './mediation/SubmissionHistory.vue'
import AnalyticsQuery from './mediation/AnalyticsQuery.vue'

const {
  // Config
  config,
  connectionStatus,

  // SIM Pool
  simPool,
  addIccid,
  removeIccid,
  generateIccids,
  clearSimPool,

  // Generator
  generatorSettings,
  generatedRecords,
  generateRecords,
  clearGeneratedRecords,

  // Submission
  submitting,
  submissionError,
  submissionHistory,
  submitSingle,
  submitBatch,
  clearHistory,

  // Connection
  testPortalConnection,
  testAnalyticsConnection,

  // Analytics
  analyticsLoading,
  analyticsError,
  analyticsResponse,
  executeAnalyticsQuery,
  clearAnalyticsResponse,

  // Computed
  canGenerate
} = useMediation()

// Handle single record submission
const handleSubmitSingle = async (record) => {
  try {
    await submitSingle(record)
  } catch (err) {
    // Error already logged to history
  }
}

// Handle batch submission
const handleSubmitBatch = async () => {
  try {
    await submitBatch()
  } catch (err) {
    // Error already logged to history
  }
}

// Handle analytics query
const handleAnalyticsQuery = async (endpoint, params) => {
  try {
    await executeAnalyticsQuery(endpoint, params)
  } catch (err) {
    // Error already set in composable
  }
}
</script>

<template>
  <div class="mediation-view">
    <!-- Connection Settings (collapsible) -->
    <ConnectionSettings
      :config="config"
      :connectionStatus="connectionStatus"
      @update:config="(val) => Object.assign(config, val)"
      @test-portal="testPortalConnection"
      @test-analytics="testAnalyticsConnection"
      class="mb-4"
    />

    <!-- Main content grid -->
    <div class="grid">
      <!-- Left column: SIM Pool + Generator -->
      <div class="col-12 lg:col-5">
        <SimPoolManager
          :simPool="simPool"
          @add-iccid="addIccid"
          @remove-iccid="removeIccid"
          @generate-iccids="generateIccids"
          @clear-pool="clearSimPool"
          class="mb-3"
        />

        <UsageGenerator
          :settings="generatorSettings"
          :canGenerate="canGenerate"
          @update:settings="(val) => Object.assign(generatorSettings, val)"
          @generate="generateRecords"
        />
      </div>

      <!-- Right column: Submission + History -->
      <div class="col-12 lg:col-7">
        <SubmissionPanel
          :records="generatedRecords"
          :submitting="submitting"
          :error="submissionError"
          @submit-single="handleSubmitSingle"
          @submit-batch="handleSubmitBatch"
          @clear-records="clearGeneratedRecords"
          class="mb-3"
        />

        <SubmissionHistory
          :history="submissionHistory"
          @clear-history="clearHistory"
        />
      </div>
    </div>

    <!-- Analytics Query (full width) -->
    <AnalyticsQuery
      :config="config"
      :loading="analyticsLoading"
      :error="analyticsError"
      :response="analyticsResponse"
      @execute-query="handleAnalyticsQuery"
      @clear-response="clearAnalyticsResponse"
      class="mt-4"
    />
  </div>
</template>

<style scoped>
.mediation-view {
  padding: 1rem;
}
</style>
