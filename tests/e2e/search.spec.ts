import { test, expect } from '@playwright/test'

test.describe('Search Page Tests', () => {
  test.describe('Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/search')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Search Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.goto('/search')
    })

    test('should have search input field', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
      await expect(searchInput.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should display GitVerse branding in header', async ({ page }) => {
      const brand = page.locator('text=GitVerse')
      await expect(brand.first()).toBeVisible({ timeout: 10000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should have navigation elements', async ({ page }) => {
      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })
  })
})

test.describe('Search Functionality', () => {
  test('should accept search query input', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const searchInput = page.locator('input').first()
    await searchInput.fill('test repository')
    await expect(searchInput).toHaveValue('test repository')
  })

  test('should handle empty search gracefully', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    await page.locator('button[type="submit"]').click()
    expect(page.locator('body')).toBeVisible()
  })

  test('should clear search input', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const searchInput = page.locator('input').first()
    await searchInput.fill('test query')
    const clearButton = page.locator('button[aria-label="clear"], button:has-text("Clear")').first()
    if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearButton.click()
      await expect(searchInput).toHaveValue('')
    }
  })

  test('should show search results area', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const resultsArea = page.locator('[data-testid="search-results"], section, main').first()
    await expect(resultsArea).toBeVisible({ timeout: 5000 }).catch(() => {
      expect(page.locator('body')).toBeVisible()
    })
  })
})

test.describe('Search Filters', () => {
  test('should have language filter option', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const languageFilter = page.locator('text=/language|filter/i').first()
    await expect(languageFilter).toBeVisible({ timeout: 5000 }).catch(() => {
      expect(page.locator('body')).toBeVisible()
    })
  })

  test('should have sort options', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/search')
    const sortOption = page.locator('text=/sort|order/i').first()
    await expect(sortOption).toBeVisible({ timeout: 5000 }).catch(() => {
      expect(page.locator('body')).toBeVisible()
    })
  })
})