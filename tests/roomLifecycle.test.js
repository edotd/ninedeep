import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_LIFETIME_MS, roomExpirationDate, roomHasExpired } from '../src/game/roomLifecycle.js';

test('rooms expire 72 hours after their latest activity', () => {
  const now = Date.UTC(2026, 8, 25, 12);
  const expiresAt = roomExpirationDate(now);

  assert.equal(ROOM_LIFETIME_MS, 72 * 60 * 60 * 1000);
  assert.equal(expiresAt.getTime(), now + ROOM_LIFETIME_MS);
  assert.equal(roomHasExpired(expiresAt, expiresAt.getTime() - 1), false);
  assert.equal(roomHasExpired(expiresAt, expiresAt.getTime()), true);
});

test('legacy rooms without an expiry remain joinable until their next activity sets one', () => {
  assert.equal(roomHasExpired(undefined), false);
});
