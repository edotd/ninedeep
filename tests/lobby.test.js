import test from 'node:test';
import assert from 'node:assert/strict';
import { startEra } from '../src/game/engine.js';
import { LEAGUE_TEAM_COUNT } from '../src/game/constants.js';
import { claimSeat, startEraOnline } from '../src/game/lobby.js';
import { closeFreeAgency, newEraState } from '../src/game/season.js';
import { rehydrateState } from '../src/game/rehydrate.js';

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

test('one browser identity cannot claim a second seat without leaving the first', () => {
  const state = { seats: [
    { seatIndex: 0, ownerUid: null, name: '' },
    { seatIndex: 1, ownerUid: null, name: '' },
  ] };
  claimSeat(state, 0, 'user-1', 'First Franchise');
  claimSeat(state, 1, 'user-1', 'Second Franchise');
  assert.equal(state.seats[0].ownerUid, 'user-1');
  assert.equal(state.seats[0].name, 'First Franchise');
  assert.equal(state.seats[1].ownerUid, null);
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

test('a new multiplayer era includes free agency closeout state', () => {
  const state = {
    phase: 'lobby',
    hostUid: 'host',
    seatCount: LEAGUE_TEAM_COUNT,
    seats: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, seatIndex) => ({
      seatIndex,
      ownerUid: seatIndex === 0 ? 'host' : null,
      name: seatIndex === 0 ? 'Test Franchise' : '',
    })),
    settings: newEraState().settings,
  };
  startEraOnline(state, 'host');
  assert.deepEqual(state.offseason, { contractsFiled: {}, freeAgencyClosed: {}, negotiations: {}, bidding: {} });
  assert.deepEqual(state.freeAgencyActivity, []);
});

test('an active multiplayer era missing offseason state is repaired before closeout', () => {
  const state = newEraState();
  startEra(state, 'Legacy Room');
  delete state.offseason;
  rehydrateState(state);
  assert.equal(closeFreeAgency(state, 0).ok, true);
  assert.equal(state.offseason.freeAgencyClosed[0], true);
});
