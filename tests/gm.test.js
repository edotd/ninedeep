import test from 'node:test';
import assert from 'node:assert/strict';
import { GM_BONUS_RATE, MARKETS, GM_TYPES } from '../src/game/constants.js';
import { acquireOffseasonPlayer, drawGM, handsOffBonus, offseasonPrice } from '../src/game/gm.js';
import { rosterSalary, formatCoins, gmCost } from '../src/game/economy.js';
import { fireGM } from '../src/game/finances.js';
import { offenseModifier } from '../src/game/roster.js';

test('aggressive GM discounts offseason signings and adds one budget hit', () => {
  const team = { id: 0, gmType: 'Aggressive', hand: [], coach: { salary: 0.5 } };
  const card = { id: 'p', salary: 3, teamTenure: null };
  const signed = acquireOffseasonPlayer(team, card);
  assert.equal(GM_BONUS_RATE, 0.02);
  assert.equal(signed.salary, 2.94);
  assert.equal(card.salary, 3);
  assert.equal(rosterSalary(team), 4.44);
  assert.equal(formatCoins(signed.salary), '🪙2.94');
  assert.equal(offseasonPrice({ gmType: 'Neutral' }, 3), 3);
});

test('hands-off bonus follows coach and complete starting-five continuity', () => {
  const hand = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, stats: { SCO: 20, PLM: 20, DEF: 20, REB: 20 }, teamTenure: { teamId: 0, completedYears: 2 } }));
  const team = { id: 0, gmType: 'Hands-Off', retainedStreak: 2, activeIds: hand.map((p) => p.id), hand, coach: { offBonus: 0, defBonus: 0, salary: 0, offDie: 6, defDie: 6 } };
  assert.equal(handsOffBonus(team), 0.08);
  const withBonus = offenseModifier(team);
  team.gmType = 'Neutral';
  assert(withBonus > offenseModifier(team));
  team.gmType = 'Hands-Off';
  hand[0].teamTenure.completedYears = 0;
  assert.equal(handsOffBonus(team), 0.04);
  team.retainedStreak = 10;
  assert.equal(handsOffBonus(team), 0.12);
});

test('firing a GM draws type and market together, leaves one season of dead cap, and is once per season', () => {
  const team = { id: 0, gmType: 'Neutral', market: { name: 'Small', capAdj: 0.5 }, seasonCap: 20, attendance: 0.5, hand: [], coach: { salary: 0 } };
  const state = { season: 2, teams: [team] };
  const outgoingCost = gmCost(team.gmType);
  const result = fireGM(state, 0);
  assert.equal(result.ok, true);
  assert(GM_TYPES.includes(team.gmType));
  assert.notEqual(team.gmType, 'Neutral');
  assert(MARKETS.some((m) => m.name === team.market.name));
  assert.equal(team.gmChangeSeason, 2);
  assert.deepEqual(team.deadCap, [{
    amount: Math.round((outgoingCost / 2) * 100) / 100,
    seasonsLeft: 1,
    kind: 'gm',
    label: 'Neutral GM',
    detail: 'Small',
  }]);
  assert.equal(rosterSalary(team), gmCost(team.gmType) + Math.round((outgoingCost / 2) * 100) / 100);
  assert(team.seasonCap <= 20 + 3.5);
  assert.equal(fireGM(state, 0).ok, false);
  const otherGM = drawGM();
  assert(MARKETS.some((m) => m.name === otherGM.market.name));
});
