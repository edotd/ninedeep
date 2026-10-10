import test from 'node:test';
import assert from 'node:assert/strict';
import { spendableRoom, isOverLimit, remainingCap } from '../src/game/economy.js';
import { MAX_CAP_OVERAGE } from '../src/game/constants.js';

function team(extra = {}) {
  return { seasonCap: 20, hand: [{ salary: 20 }], coach: null, gmType: null, deadCap: [], ...extra };
}

test('a team at its cap can still commit up to MAX_CAP_OVERAGE more', () => {
  const t = team();
  assert.equal(remainingCap(t), 0);
  assert.equal(spendableRoom(t), MAX_CAP_OVERAGE);
  assert.equal(isOverLimit(t), false);
  t.hand.push({ salary: 2.5 });
  assert.equal(isOverLimit(t), false);
  assert.equal(spendableRoom(t), 0.5);
  t.hand.push({ salary: 1 });
  assert.equal(isOverLimit(t), true);
});

test('no overage allowance the season after going over', () => {
  const t = team({ overBudgetLastSeason: true });
  assert.equal(spendableRoom(t), 0);
  t.hand.push({ salary: 0.5 });
  assert.equal(isOverLimit(t), true);
});

test('retrying Begin Season after a failed confirm is not blocked by its own earlier attempt', async () => {
  const { confirmLineup } = await import('../src/game/engine.js');
  const { newEraState } = await import('../src/game/season.js');
  const state = newEraState();
  const cards = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, position: ['Guard', 'Forward', 'Big'][i % 3], salary: 2 }));
  const t = { id: 0, human: true, hand: cards, activeIds: cards.slice(0, 5).map((c) => c.id), seasonCap: 13, coach: { salary: 0 }, lineupSet: true, deadCap: [] };
  const other = { id: 1, human: true, hand: [], activeIds: [], seasonCap: 20, coach: { salary: 0 }, lineupSet: true, deadCap: [] };
  state.teams = [t, other];
  state.offseason = { freeAgencyClosed: { 0: true, 1: true } };
  assert.equal(confirmLineup(state, 0).valid, true); // 1.0 over
  t.lineupConfirmed = false;
  assert.equal(confirmLineup(state, 0).valid, true); // still fine to retry
});
