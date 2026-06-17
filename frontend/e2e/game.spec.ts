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

    // Toggle to vs Human mode to show Host Private button
    const vsHumanButton = page.locator('button:has-text("vs Human")');
    await expect(vsHumanButton).toBeVisible();
    await vsHumanButton.click();

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

    await cancelButton.click();

    // Confirm cancel in custom modal
    const modalConfirm = page.locator('.fixed button:has-text("Cancel Game")');
    await expect(modalConfirm).toBeVisible();
    await modalConfirm.click();

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
    
    // Toggle to vs Human mode to show Host Private button
    const vsHumanButton = hostPage.locator('button:has-text("vs Human")');
    await expect(vsHumanButton).toBeVisible();
    await vsHumanButton.click();
    
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

  test('should host a private game, and cancel it directly from the game page', async ({ page }) => {
    await page.goto('/');

    // Toggle to vs Human mode to show Host Private button
    const vsHumanButton = page.locator('button:has-text("vs Human")');
    await expect(vsHumanButton).toBeVisible();
    await vsHumanButton.click();

    // Host Private Game
    const hostPrivateButton = page.locator('button:has-text("Host Private")');
    await expect(hostPrivateButton).toBeVisible();
    await hostPrivateButton.click();

    // Verify navigation to GamePage
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+/);

    // Cancel Button should be visible
    const cancelButton = page.locator('button:has-text("Cancel Game")');
    await expect(cancelButton).toBeVisible();

    await cancelButton.click();

    // Confirm cancel in custom modal
    const modalConfirm = page.locator('.fixed button:has-text("Cancel Game")');
    await expect(modalConfirm).toBeVisible();
    await modalConfirm.click();

    // Verify we are redirected back to the lobby
    await expect(page).toHaveURL(/\/$/);
  });

  test('should start a game vs AI, and forfeit it from the game page', async ({ page }) => {
    await page.goto('/');

    // Host AI Game
    const playAiButton = page.locator('button:has-text("Play vs AI")');
    await expect(playAiButton).toBeVisible();
    await playAiButton.click();

    // Verify navigation to GamePage
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+/);

    // Forfeit Button should be visible since status is in_progress
    const forfeitButton = page.locator('button:has-text("Forfeit Match")');
    await expect(forfeitButton).toBeVisible();

    await forfeitButton.click();

    // Confirm forfeit in custom modal
    const modalConfirm = page.getByRole('button', { name: 'Forfeit', exact: true });
    await expect(modalConfirm).toBeVisible();
    await modalConfirm.click();

    // Verify status banner changes to Winner
    const statusBanner = page.locator('h2');
    await expect(statusBanner).toContainText('Aggressive Archie (Medium) Wins!');
  });

  test('should play a Grail Quest game vs AI: deploy and end deploy phase', async ({ page }) => {
    await page.goto('/');

    // Click on the Grail Quest tab
    const grailQuestTab = page.locator('button:has-text("Grail Quest")');
    await expect(grailQuestTab).toBeVisible();
    await grailQuestTab.click();

    // Click "Play vs AI" button
    const playVsAiButton = page.locator('button:has-text("Play vs AI")');
    await expect(playVsAiButton).toBeVisible();
    await playVsAiButton.click();

    // Verify navigation to GamePage
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+/);

    // Verify status banner states Deploy Phase
    const statusBanner = page.locator('h2');
    await expect(statusBanner).toContainText(/Your Turn: Deploy Units/i);

    // Let's click the King (K) card button first
    const kingCard = page.locator('button').filter({ hasText: 'King' }).first();
    await expect(kingCard).toBeVisible();
    await kingCard.click();

    // The player's home base is at coordinates "0,-3".
    const baseCell = page.getByTestId('cell-0,-3');
    await expect(baseCell).toBeVisible();
    await baseCell.click();

    // Let's also select and deploy a Queen to the base cell
    const queenCard = page.locator('button').filter({ hasText: 'Queen' }).first();
    await expect(queenCard).toBeVisible();
    await queenCard.click();
    await baseCell.click();

    // Now click the "Go to Movement" button to transit to move phase
    const endDeployButton = page.locator('button:has-text("Go to Movement")');
    await expect(endDeployButton).toBeVisible();
    await endDeployButton.click();

    // Verify the status banner changes to Move Phase
    await expect(statusBanner).toContainText(/Your Turn: Move Units/i);
  });
});
