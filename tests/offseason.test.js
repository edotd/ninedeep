import test from 'node:test';
import assert from 'node:assert/strict';
import { newEraState, fileRoster, fileOffseasonLineup, finishFreeAgency, renewExpiredContract } from '../src/game/season.js';

test('offseason gates roster and lineup filing and advances only after both approvals', () => {
  const state = newEraState();
  state.season = 8;
  const team = { id: 0, human: true, hand: [], activeIds: [], coach: { salary: 0 } };
  state.teams = [team];
  state.offseason = { contractsFiled: {}, rosterFiled: {}, lineupFiled: {} };
  state.phase = 'freeagency';
  assert.equal(finishFreeAgency(state).ok, false);
  assert.equal(fileRoster(state, 0).ok, false);
  for (let i = 0; i < 9; i++) team.hand.push({ id: i, position: ['Guard', 'Forward', 'Big'][i % 3], salary: 1, contract: 2, stats: { SCO: 4, PLM: 4, DEF: 4, REB: 4 }, age: 25 });
  assert.equal(finishFreeAgency(state).ok, true);
  assert.equal(state.phase, 'roster');
  assert.equal(fileRoster(state, 0).ok, true);
  assert.equal(state.phase, 'offseasonlineup');
  assert.equal(team.activeIds.length, 5);
  assert.equal(fileOffseasonLineup(state, 0).ok, true);
  assert.equal(state.season, 9);
  assert.equal(state.phase, 'era_end');
});

test('an expired player can only be renewed by the former team while contracts are open', () => {
  const state = newEraState();
  state.phase = 'contracts';
  state.teams = [{ id: 0, human: true, hand: [] }, { id: 1, human: true, hand: [] }];
  state.offseason = { contractsFiled: {}, rosterFiled: {}, lineupFiled: {} };
  state.freeAgents = [{ id: 'expired', lastTeamId: 0, salary: 2 }];
  assert.equal(renewExpiredContract(state, 1, 'expired').ok, false);
  assert.equal(renewExpiredContract(state, 0, 'expired').ok, true);
  assert.equal(state.teams[0].hand.length, 1);
  assert.equal(state.freeAgents.length, 0);
});
