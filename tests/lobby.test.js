import test from 'node:test';
import assert from 'node:assert/strict';
import { startEra } from '../src/game/engine.js';
import { LEAGUE_TEAM_COUNT } from '../src/game/constants.js';
import { claimSeat, startEraOnline } from '../src/game/lobby.js';
import { newEraState } from '../src/game/season.js';

test('solo era cannot start without a franchise name', () => {
  const state = newEraState();
  const initialPhase = state.phase;
  assert.equal(startEra(state, '   '), false);
  assert.equal(state.phase, initialPhase);
  assert.equal(state.teams.length, 0);
});

test('a new solo era contains nine teams', () => {
  const state = newEraState();
  assert.equal(startEra(state, 'Test'), true);
  assert.equal(state.teams.length, LEAGUE_TEAM_COUNT);
  assert.equal(LEAGUE_TEAM_COUNT, 9);
});

test('an online seat requires a franchise name before it can be claimed', () => {
  const state = { seats: [{ seatIndex: 0, ownerUid: null, name: '' }] };
  claimSeat(state, 0, 'user-1', '  ');
  assert.equal(state.seats[0].ownerUid, null);
  claimSeat(state, 0, 'user-1', '  Riverside Ironclads  ');
  assert.equal(state.seats[0].ownerUid, 'user-1');
  assert.equal(state.seats[0].name, 'Riverside Ironclads');
});

test('online era rejects a legacy claimed seat with no franchise name', () => {
  const state = {
    phase: 'lobby',
    hostUid: 'host',
    seats: [{ seatIndex: 0, ownerUid: 'host', name: '' }],
  };
  startEraOnline(state, 'host');
  assert.equal(state.phase, 'lobby');
});
