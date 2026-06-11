import { test, expect } from '@playwright/test';

test.describe('Vibe Games Matchmaking & Gameplay E2E', () => {
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
});
