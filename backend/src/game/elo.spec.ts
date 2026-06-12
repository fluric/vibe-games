import { calculateElo } from './elo';
import assert from 'assert';

console.log('🧪 Testing ELO calculations...');

// Test win against equal opponent (expected score = 0.5, rating delta = 32 * (1 - 0.5) = 16)
const newRatingEqualWin = calculateElo(1200, 1200, 1);
console.log(`Equal opponent win: 1200 vs 1200 -> ${newRatingEqualWin} (Expected: 1216)`);
assert.strictEqual(newRatingEqualWin, 1216);

// Test loss against equal opponent (expected score = 0.5, rating delta = 32 * (0 - 0.5) = -16)
const newRatingEqualLoss = calculateElo(1200, 1200, 0);
console.log(`Equal opponent loss: 1200 vs 1200 -> ${newRatingEqualLoss} (Expected: 1184)`);
assert.strictEqual(newRatingEqualLoss, 1184);

// Test win against stronger opponent
const newRatingStrongerWin = calculateElo(1200, 1600, 1);
console.log(`Stronger opponent win: 1200 vs 1600 -> ${newRatingStrongerWin} (Expected: 1229)`);
assert.strictEqual(newRatingStrongerWin, 1229);

// Test loss against weaker opponent
const newRatingWeakerLoss = calculateElo(1200, 800, 0);
console.log(`Weaker opponent loss: 1200 vs 800 -> ${newRatingWeakerLoss} (Expected: 1171)`);
assert.strictEqual(newRatingWeakerLoss, 1171);

// Test draw against equal opponent
const newRatingEqualDraw = calculateElo(1200, 1200, 0.5);
console.log(`Equal opponent draw: 1200 vs 1200 -> ${newRatingEqualDraw} (Expected: 1200)`);
assert.strictEqual(newRatingEqualDraw, 1200);

console.log('✅ All ELO tests passed!');
