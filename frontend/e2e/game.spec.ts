import { test, expect } from '@playwright/test';

test.describe('Vibe Games Matchmaking & Gameplay E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Perform Mock Login with a unique user per test to avoid state collision in parallel runs
    const testId = Math.random().toString(36).substring(2, 11);
    await page.goto('/');
    await page.fill('input[placeholder="Developer Name"]', `User_${testId}`);
    await page.fill('input[placeholder="developer@vibegames.local"]', `test-${testId}@vibegames.local`);
    await page.click('button[type="submit"]');
    await expect(page.locator('h3:has-text("Create a New Match")')).toBeVisible();
  });

  test('should create a game vs AI, make a placement move, and verify AI responds', async ({ page }) => {
    // Navigate to the main dashboard lobby
    await page.goto('/');

    // Check heading
    await expect(page.locator('h1')).toHaveText('Vibe Games');

    // Click "Play vs AI" button
    const playVsAiButton = page.locator('button:has-text("Play vs AI")');
    await expect(playVsAiButton).toBeVisible();
    await playVsAiButton.click();

    // Verify navigation to an active game page (/game/:id)
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+/);

    // Check that it states it is X's turn to place a piece
    const banner = page.locator('h2');
    await expect(banner).toHaveText(/Your Turn: Place Piece/i);

    // X places at node 0 (top-left of outer square)
    const node0 = page.getByTestId('node-0');
    await expect(node0).toBeVisible();
    await node0.click();

    // After clicking node 0, the backend processes the move for X,
    // then immediately triggers the AI response loop for O,
    // which places a piece for O and hands the turn back to X.
    // Therefore, the banner should return to stating "Your Turn: Place Piece".
    await expect(banner).toHaveText(/Your Turn: Place Piece/i);

    // Locate the Player X and Player O details cards using test-ids
    const playerXCard = page.getByTestId('player-x-card');
    const playerOCard = page.getByTestId('player-o-card');

    // Both X and O should have 8 placements remaining (down from 9)
    await expect(playerXCard.locator('span:has-text("Placements Left:") + span')).toHaveText('8');
    await expect(playerOCard.locator('span:has-text("Placements Left:") + span')).toHaveText('8');

    // Both X and O should have 1 active piece on the board
    await expect(playerXCard.locator('span:has-text("Active Pieces:") + span')).toHaveText('1');
    await expect(playerOCard.locator('span:has-text("Active Pieces:") + span')).toHaveText('1');
  });

  test('should host a private game, navigate away, and cancel it from active matches list', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
    await page.goto('/');

    // Host Private Game
    const hostPrivateButton = page.locator('button:has-text("Host Private")');
    await expect(hostPrivateButton).toBeVisible();
    await hostPrivateButton.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+/);

    // Go back to lobby
    await page.goto('/');

    // Verify "Your Active Matches" section header is visible
    const activeHeader = page.locator('h3:has-text("Your Active Matches")');
    await expect(activeHeader).toBeVisible();

    // Find the Cancel button for the active match
    const cancelButton = page.locator('button:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();

    // Handle dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to cancel this game lobby?');
      await dialog.accept();
    });

    await cancelButton.click();

    // Wait for the match to be deleted and removed from the UI list
    await expect(activeHeader).not.toBeVisible();
  });

  test('should redirect unauthenticated user from game link to lobby, and navigate back after login', async ({ browser }) => {
    // Create isolated host and guest contexts
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // 1. Create a game first as host
    const testId = Math.random().toString(36).substring(2, 11);
    await hostPage.goto('/');
    await hostPage.fill('input[placeholder="Developer Name"]', `Host_${testId}`);
    await hostPage.fill('input[placeholder="developer@vibegames.local"]', `host-${testId}@vibegames.local`);
    await hostPage.click('button[type="submit"]');
    await hostPage.click('button:has-text("Host Private")');
    await hostPage.waitForURL(/\/game\/[a-f0-9-]+/);
    const gameUrl = hostPage.url();

    // 2. Open the game link in the clean guest page
    await guestPage.goto(gameUrl);

    // 3. Verify it redirects to the lobby with the redirect query parameter
    await expect(guestPage).toHaveURL(new RegExp(`\\/\\?redirect=%2Fgame%2F[a-f0-9-]+`));

    // 4. Perform login on the guest page
    const guestId = Math.random().toString(36).substring(2, 11);
    await guestPage.fill('input[placeholder="Developer Name"]', `Guest_${guestId}`);
    await guestPage.fill('input[placeholder="developer@vibegames.local"]', `guest-${guestId}@vibegames.local`);
    await guestPage.click('button[type="submit"]');

    // 5. Verify it automatically navigates back to the game page
    await expect(guestPage).toHaveURL(new RegExp(gameUrl));
    
    // Cleanup contexts
    await hostContext.close();
    await guestContext.close();
  });
});
