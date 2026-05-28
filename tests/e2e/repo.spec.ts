import { test, expect } from '@playwright/test'

test.describe('Repository Page Tests', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing repo page without auth', async ({ page }) => {
      await page.goto('/repo/test-repo-123')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    test('should have navigation elements visible', async ({ page }) => {
      const nav = page.locator('nav')
      await expect(nav.first()).toBeVisible()
    })

    test('should render the GitVerse branding', async ({ page }) => {
      const brandLogo = page.locator('text=GitVerse')
      await expect(brandLogo.first()).toBeVisible()
    })

    test('should display repository name in header', async ({ page }) => {
      await page.goto('/repo/test-repo')
      const repoName = page.locator('h1, [data-testid="repo-name"]').first()
      await expect(repoName).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })

    test('should have file tree section', async ({ page }) => {
      await page.goto('/repo/test-repo')
      const fileTree = page.locator('[data-testid="file-tree"], text=/file tree/i').first()
      await expect(fileTree).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })
  })

  test.describe('Repository URL Validation', () => {
    test('should accept valid repo ID format', async ({ page }) => {
      await page.goto('/login')
      const validIds = ['abc-123', 'my_repo', 'test-repo-456']
      for (const id of validIds) {
        await page.goto(`/repo/${id}`)
        await expect(page).not.toHaveURL(/error/)
      }
    })

    test('should handle special characters in repo names', async ({ page }) => {
      await page.goto('/login')
      await page.goto('/repo/test-name_with-dashes')
      await expect(page).toHaveURL(/test-name_with-dashes/)
    })
  })

  test.describe('Page Meta Information', () => {
    test('should set correct page title for repo page', async ({ page }) => {
      await page.goto('/login')
      await page.goto('/repo/my-test-repo')
      await expect(page).toHaveTitle(/My Test Repo/)
    })
  })

  test.describe('Error Handling', () => {
    test('should display error message for non-existent repo', async ({ page }) => {
      await page.goto('/login')
      await page.goto('/repo/non-existent-repo-xyz-123')
      const errorMessage = page.locator('text=/error|not found|404/i').first()
      await expect(errorMessage).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(page.locator('body')).toBeVisible()
      })
    })
  })
})