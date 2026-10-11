import test from 'node:test';
import assert from 'node:assert/strict';
import { saveLineup } from '../src/game/engine.js';

test('saveLineup remembers the slot layout including sixth man and depth', () => {
  const hand = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, position: ['Guard', 'Forward', 'Big'][i % 3], salary: 1, stats: { SCO: 5, PLM: 5, REB: 5, DEF: 5 } }));
  const team = { id: 0, hand, activeIds: [], coach: { gameplans: [] } };
  const state = { teams: [team], season: 1 };
  const res = saveLineup(state, 0, ['p4', 'p0', 'p1', 'p2', 'p3'], '', 'p6', 'p7');
  assert.equal(res.valid, true);
  assert.deepEqual(team.lineupSlots, { starters: ['p4', 'p0', 'p1', 'p2', 'p3'], sixth: 'p6', depth: 'p7' });
  assert.equal(team.sixthManId, 'p6');
  assert.equal(team.depthId, 'p7');
});

test('a lineup needs no particular positions', () => {
  const hand = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, position: 'Guard', salary: 1, stats: { SCO: 5, PLM: 5, REB: 5, DEF: 5 } }));
  const team = { id: 0, hand, activeIds: [], coach: { gameplans: [] } };
  assert.equal(saveLineup({ teams: [team], season: 1 }, 0, hand.map((c) => c.id), '').valid, true);
});

test('saveLineupSlots remembers a half-filled lineup without touching the saved five', async () => {
  const { saveLineupSlots } = await import('../src/game/engine.js');
  const hand = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, position: 'Guard', salary: 1, stats: { SCO: 5, PLM: 5, REB: 5, DEF: 5 } }));
  const team = { id: 0, hand, activeIds: ['p0', 'p1', 'p2', 'p3', 'p4'], lineupSet: true, coach: { gameplans: [] } };
  const res = saveLineupSlots({ teams: [team], season: 1 }, 0, { starters: ['p5', null, 'p2', null, null], sixth: 'p5', depth: 'p9' });
  assert.equal(res.valid, true);
  assert.deepEqual(team.lineupSlots, { starters: ['p5', null, 'p2', null, null], sixth: null, depth: null });
  assert.deepEqual(team.activeIds, ['p0', 'p1', 'p2', 'p3', 'p4']);
  assert.equal(team.lineupSet, true);
});
