import { test, expect } from '@playwright/test';

test.describe('Vibe Games Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Perform Mock Login with a unique user per test to avoid state collision in parallel runs
    const testId = Math.random().toString(36).substring(2, 11);
    await page.goto('/');
    await page.fill('input[placeholder="Developer Name"]', `User_${testId}`);
    await page.fill('input[placeholder="developer@vibegames.local"]', `test-${testId}@vibegames.local`);
    await page.click('button[type="submit"]');
    await expect(page.locator('h3:has-text("Create a New Match")')).toBeVisible();
  });

  test('should load the page and show correct elements', async ({ page }) => {
    // Navigate to the root lobby page
    await page.goto('/');

    // Check heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Vibe Games');

    // Check that the rating displays correctly
    const ratingElement = page.locator('text=1200 ELO');
    await expect(ratingElement).toBeVisible();

    // Verify link to Status exists (System Health)
    const statusLink = page.locator('text=System Health');
    await expect(statusLink).toBeVisible();
  });

  test('should navigate to status page and verify system connectivity metrics', async ({ page }) => {
    await page.goto('/');
    
    // Click on System Health link and check URL transition
    await page.click('text=System Health');
    await expect(page).toHaveURL('/status');

    // Verify Dashboard elements exist on /status
    const apiStatus = page.locator('span:has-text("API Gateway:")');
    await expect(apiStatus).toBeVisible();

    const dbStatus = page.locator('span:has-text("PostgreSQL DB:")');
    await expect(dbStatus).toBeVisible();

    // The text content adjacent to API Gateway should say "Online"
    const apiOnlineStatus = page.locator('span:has-text("API Gateway:") + span');
    await expect(apiOnlineStatus).toHaveText('Online');

    // The text content adjacent to PostgreSQL DB should say "Connected"
    const dbConnectedStatus = page.locator('span:has-text("PostgreSQL DB:") + span');
    await expect(dbConnectedStatus).toHaveText('Connected');

    // Test back navigation
    await page.click('text=Back to Dashboard');
    await expect(page).toHaveURL('/');
  });

  test('should verify the backend health check endpoint is reachable', async ({ request }) => {
    // Call the backend health check
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.database).toBe(true);
  });
});
