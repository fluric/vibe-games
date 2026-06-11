import { test, expect } from '@playwright/test';

test.describe('Vibe Games Landing Page', () => {
  test('should load the page and show correct elements', async ({ page }) => {
    // Navigate to the root
    await page.goto('/');

    // Check heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Get started');

    // Check that the counter starts at 0
    const counterButton = page.locator('button.counter');
    await expect(counterButton).toHaveText('Count is 0');

    // Click the counter button
    await counterButton.click();

    // Check that the counter increments to 1
    await expect(counterButton).toHaveText('Count is 1');

    // Verify System Connectivity Dashboard elements
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
