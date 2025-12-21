import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InvoiceList from '@/components/billing/InvoiceList.vue'
import PrimeVue from 'primevue/config'
import type { Invoice } from '@/types/invoice'

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    carrierId: 'carrier1',
    carrierName: 'Carrier One',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    totalAmount: 1500.00,
    currency: 'CHF',
    status: 'pending',
    dueDate: '2024-02-15',
    paidDate: null,
    pdfUrl: 'https://example.com/invoice1.pdf',
    erpnextReference: 'ERP-001'
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    carrierId: 'carrier2',
    carrierName: 'Carrier Two',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    totalAmount: 2500.00,
    currency: 'CHF',
    status: 'paid',
    dueDate: '2024-02-15',
    paidDate: '2024-02-10',
    pdfUrl: null,
    erpnextReference: 'ERP-002'
  }
]

const mockCarriers = [
  { id: 'carrier1', name: 'Carrier One' },
  { id: 'carrier2', name: 'Carrier Two' }
]

describe('InvoiceList', () => {
  const createWrapper = (props = {}) => {
    return mount(InvoiceList, {
      props: {
        invoices: mockInvoices,
        loading: false,
        statusFilter: null,
        carrierFilter: null,
        carriers: mockCarriers,
        ...props
      },
      global: {
        plugins: [[PrimeVue, {}]],
        stubs: {
          DataTable: {
            template: '<div class="datatable-stub"><slot /></div>',
            props: ['value', 'loading']
          },
          Column: {
            template: '<div class="column-stub"><slot /></div>',
            props: ['field', 'header']
          },
          Tag: {
            template: '<span class="tag-stub">{{ value }}</span>',
            props: ['value', 'severity']
          },
          Button: {
            template: '<button class="button-stub" @click="$emit(\'click\')"><slot /></button>',
            props: ['label', 'icon', 'link', 'severity', 'size', 'text', 'rounded']
          },
          Dropdown: {
            template: '<select class="dropdown-stub"><slot /></select>',
            props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder']
          }
        },
        directives: {
          tooltip: {}
        }
      }
    })
  }

  it('should render invoice list component', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.invoice-list').exists()).toBe(true)
  })

  it('should display invoices in data table', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.datatable-stub').exists()).toBe(true)
  })

  it('should show loading state', () => {
    const wrapper = createWrapper({ loading: true })
    expect(wrapper.props('loading')).toBe(true)
  })

  it('should emit update:statusFilter event', async () => {
    const wrapper = createWrapper()
    await wrapper.vm.$emit('update:statusFilter', 'pending')
    expect(wrapper.emitted('update:statusFilter')).toBeTruthy()
  })

  it('should emit update:carrierFilter event', async () => {
    const wrapper = createWrapper()
    await wrapper.vm.$emit('update:carrierFilter', 'carrier1')
    expect(wrapper.emitted('update:carrierFilter')).toBeTruthy()
  })

  it('should display correct status severity colors', () => {
    const wrapper = createWrapper()
    expect(wrapper.vm.getStatusSeverity('pending')).toBe('warning')
    expect(wrapper.vm.getStatusSeverity('paid')).toBe('success')
    expect(wrapper.vm.getStatusSeverity('overdue')).toBe('danger')
    expect(wrapper.vm.getStatusSeverity('disputed')).toBe('info')
  })

  it('should format currency correctly', () => {
    const wrapper = createWrapper()
    const formatted = wrapper.vm.formatCurrency(1500, 'CHF')
    expect(formatted).toContain('1')
    expect(formatted).toContain('500')
  })

  it('should have invoice with pdfUrl', () => {
    const invoice = mockInvoices[0]
    expect(invoice.pdfUrl).not.toBeNull()
  })

  it('should have invoice without pdfUrl', () => {
    const invoice = mockInvoices[1]
    expect(invoice.pdfUrl).toBeNull()
  })
})
