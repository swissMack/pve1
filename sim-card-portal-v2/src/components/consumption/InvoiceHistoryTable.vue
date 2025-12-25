<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAppSettings } from '../../composables/useAppSettings'

const { formatCurrency } = useAppSettings()

interface DateRange {
  start: string
  end: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  carrierId: string
  carrierName: string
  periodStart: string
  periodEnd: string
  totalAmount: number
  currency: string
  status: 'pending' | 'paid' | 'overdue' | 'disputed'
  dueDate: string
  paidDate?: string
  pdfUrl?: string
  erpnextReference?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

defineProps<{
  dateRange: DateRange
}>()

const invoices = ref<Invoice[]>([])
const pagination = ref<Pagination>({
  page: 1,
  limit: 5,
  total: 0,
  totalPages: 0
})
const loading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<string>('')

const fetchInvoices = async () => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams({
      page: pagination.value.page.toString(),
      limit: pagination.value.limit.toString()
    })

    if (statusFilter.value) {
      params.append('status', statusFilter.value)
    }

    const response = await fetch(`/api/consumption/invoices?${params}`)
    const result = await response.json()

    if (result.success) {
      invoices.value = result.data
      pagination.value = result.pagination
    } else {
      error.value = result.error || 'Failed to load invoices'
    }
  } catch (err) {
    console.error('Error fetching invoices:', err)
    error.value = 'Network error'
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-500/10 text-green-400 border-green-500/30'
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'overdue':
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    case 'disputed':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  }
}

const goToPage = (page: number) => {
  if (page < 1 || page > pagination.value.totalPages) return
  pagination.value.page = page
  fetchInvoices()
}

const handleDownload = (invoice: Invoice) => {
  if (invoice.pdfUrl) {
    window.open(invoice.pdfUrl, '_blank')
  } else {
    console.log('No PDF available for invoice:', invoice.invoiceNumber)
  }
}

const handleERPNextLink = (invoice: Invoice) => {
  if (invoice.erpnextReference) {
    // In production, this would link to ERPNext
    console.log('Open ERPNext:', invoice.erpnextReference)
  }
}

onMounted(fetchInvoices)
watch(statusFilter, () => {
  pagination.value.page = 1
  fetchInvoices()
})
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden flex flex-col h-[480px]">
    <!-- Header (sticky) -->
    <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-purple-400">receipt_long</span>
        <h3 class="text-white font-semibold">Invoice History</h3>
      </div>

      <!-- Status Filter -->
      <select
        v-model="statusFilter"
        class="px-3 py-1.5 bg-background-dark border border-border-dark rounded-lg text-white text-sm focus:border-primary focus:outline-none"
      >
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="disputed">Disputed</option>
      </select>
    </div>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-5">
      <div v-if="loading" class="h-[200px] flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>

      <div v-else-if="error" class="h-[200px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>
      </div>

      <div v-else-if="invoices.length === 0" class="h-[200px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-text-secondary text-3xl mb-2">receipt</span>
          <p class="text-text-secondary text-sm">No invoices found</p>
        </div>
      </div>

      <!-- Invoice List -->
      <div v-else class="space-y-3">
        <div
          v-for="invoice in invoices"
          :key="invoice.id"
          class="flex items-center justify-between p-3 bg-background-dark rounded-lg border border-border-dark hover:border-primary/30 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-white font-medium text-sm">{{ invoice.invoiceNumber }}</span>
              <span
                :class="[
                  'px-2 py-0.5 text-xs rounded border capitalize',
                  getStatusClass(invoice.status)
                ]"
              >
                {{ invoice.status }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-text-secondary">
              <span>{{ invoice.carrierName }}</span>
              <span>{{ formatDate(invoice.periodStart) }} - {{ formatDate(invoice.periodEnd) }}</span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-white font-semibold">
                {{ formatCurrency(invoice.totalAmount) }}
              </div>
              <div class="text-xs text-text-secondary">
                Due: {{ formatDate(invoice.dueDate) }}
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1">
              <button
                v-if="invoice.pdfUrl"
                @click="handleDownload(invoice)"
                class="p-2 text-text-secondary hover:text-primary transition-colors"
                title="Download PDF"
              >
                <span class="material-symbols-outlined text-[18px]">download</span>
              </button>
              <button
                v-if="invoice.erpnextReference"
                @click="handleERPNextLink(invoice)"
                class="p-2 text-text-secondary hover:text-primary transition-colors"
                title="Open in ERPNext"
              >
                <span class="material-symbols-outlined text-[18px]">open_in_new</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination Footer (sticky) -->
    <div v-if="!loading && !error && invoices.length > 0 && pagination.totalPages > 1" class="px-5 py-3 border-t border-border-dark flex items-center justify-between shrink-0 bg-surface-dark">
      <span class="text-xs text-text-secondary">
        Showing {{ (pagination.page - 1) * pagination.limit + 1 }} -
        {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }}
      </span>

      <div class="flex items-center gap-1">
        <button
          @click="goToPage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          :class="[
            'p-1.5 rounded transition-colors',
            pagination.page === 1
              ? 'text-text-secondary cursor-not-allowed'
              : 'text-white hover:bg-primary/20'
          ]"
        >
          <span class="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        <span class="px-3 text-sm text-white">
          {{ pagination.page }} / {{ pagination.totalPages }}
        </span>

        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="pagination.page === pagination.totalPages"
          :class="[
            'p-1.5 rounded transition-colors',
            pagination.page === pagination.totalPages
              ? 'text-text-secondary cursor-not-allowed'
              : 'text-white hover:bg-primary/20'
          ]"
        >
          <span class="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  </div>
</template>
