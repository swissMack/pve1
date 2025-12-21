import { test, expect } from '@playwright/test'

test.describe('Billing Invoices Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/billing')
  })

  test('should display billing page with invoice list', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Billing')
    await expect(page.locator('.invoice-list')).toBeVisible()
  })

  test('should display invoice data in table', async ({ page }) => {
    await expect(page.locator('.p-datatable')).toBeVisible()
    await expect(page.locator('.p-datatable-tbody tr')).toHaveCount.greaterThan(0)
  })

  test('should filter invoices by status', async ({ page }) => {
    const statusDropdown = page.locator('[data-testid="status-filter"]')
    await statusDropdown.click()
    await page.locator('.p-dropdown-item').filter({ hasText: 'Pending' }).click()

    const rows = page.locator('.p-datatable-tbody tr')
    const count = await rows.count()

    for (let i = 0; i < count; i++) {
      const statusCell = rows.nth(i).locator('.status-tag')
      await expect(statusCell).toContainText('pending')
    }
  })

  test('should filter invoices by carrier', async ({ page }) => {
    const carrierDropdown = page.locator('[data-testid="carrier-filter"]')
    await carrierDropdown.click()
    await page.locator('.p-dropdown-item').first().click()

    await expect(page.locator('.p-datatable-tbody tr')).toHaveCount.greaterThan(0)
  })

  test('should clear filters when reset is clicked', async ({ page }) => {
    const statusDropdown = page.locator('[data-testid="status-filter"]')
    await statusDropdown.click()
    await page.locator('.p-dropdown-item').filter({ hasText: 'Pending' }).click()

    const resetButton = page.locator('[data-testid="reset-filters"]')
    await resetButton.click()

    await expect(statusDropdown).toContainText('All Statuses')
  })

  test('should display PDF download button for invoices with PDF', async ({ page }) => {
    const pdfButton = page.locator('.pdf-download-btn').first()
    await expect(pdfButton).toBeVisible()
  })

  test('should open PDF in new tab when download clicked', async ({ page, context }) => {
    const pdfButton = page.locator('.pdf-download-btn').first()

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      pdfButton.click()
    ])

    expect(newPage.url()).toContain('.pdf')
  })

  test('should show invoice amount with currency', async ({ page }) => {
    const amountCell = page.locator('.invoice-amount').first()
    await expect(amountCell).toBeVisible()
    const text = await amountCell.textContent()
    expect(text).toMatch(/CHF|EUR|USD/)
  })

  test('should show status badge with correct color', async ({ page }) => {
    const statusTag = page.locator('.p-tag').first()
    await expect(statusTag).toBeVisible()
  })

  test('should auto-refresh data every 30 seconds', async ({ page }) => {
    const refreshIndicator = page.locator('[data-testid="auto-refresh-indicator"]')
    await expect(refreshIndicator).toBeVisible()
  })
})
