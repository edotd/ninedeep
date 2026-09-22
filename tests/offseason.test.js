import test from 'node:test';
import assert from 'node:assert/strict';
import { newEraState, renewExpiredContract, signFreeAgent } from '../src/game/season.js';
import { startDraft, draftPick } from '../src/game/draft.js';
import { startEra, confirmLineup } from '../src/game/engine.js';
import { hireFreeAgentCoach, releasePlayer } from '../src/game/finances.js';
import { LEAGUE_ACCOLADES, TIERS } from '../src/game/constants.js';

test('Generational Talent is a modifier while All-Star and Most Valuable Player are accolades', () => {
  assert(TIERS.some((tier) => tier.name === 'Generational Talent'));
  assert(!TIERS.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'Most Valuable Player'));
});

test('free agency begins with two to four coaches and excludes Hall of Fame', () => {
  for (let run = 0; run < 30; run++) {
    const state = newEraState();
    startEra(state, 'Test');
    assert(state.freeAgentCoaches.length >= 2 && state.freeAgentCoaches.length <= 4);
    assert(state.freeAgentCoaches.every((coach) => coach.modifier !== 'Hall of Fame'));
  }
});

test('a free agent coach can be hired and leaves the pool', () => {
  const state = newEraState();
  startEra(state, 'Test');
  const team = state.teams[0];
  const coach = state.freeAgentCoaches[0];
  const priorCoach = team.coach;
  team.seasonCap = 100;
  assert.equal(hireFreeAgentCoach(state, team.id, coach.id).ok, true);
  assert.equal(team.coach.id, coach.id);
  assert.notEqual(team.coach, priorCoach);
  assert.equal(state.freeAgentCoaches.some((candidate) => candidate.id === coach.id), false);
});

test('every team drafts a Young non-accolade player and resolves an oversized roster on Team', () => {
  const state = newEraState();
  startEra(state, 'Test');
  state.season = 2;
  state.seeds = state.teams.map((t) => ({ t }));
  const team = state.teams[0];
  startDraft(state);
  assert.equal(state.phase, 'draft');
  const accoladeNames = new Set(LEAGUE_ACCOLADES.map((tier) => tier.name));
  assert(state.draft.pool.every((card) => card.careerStage === 'Young'));
  assert(state.draft.pool.every((card) => card.skillsetId !== 'skill-03'));
  assert(state.draft.pool.every((card) => !accoladeNames.has(card.tierName)));
  draftPick(state, 0, state.draft.pool[0].id);
  assert.equal(state.phase, 'teamsummary');
  assert.equal(state.season, 3);
  assert.equal(team.hand.length, 10);
  assert.equal(team.activeIds.length, 5);
  const releasedCard = team.hand[9];
  const releasedSalary = releasedCard.salary;
  const releasedYears = releasedCard.contract;
  assert.equal(releasePlayer(state, 0, team.hand[9].id).ok, true);
  assert.equal(team.hand.length, 9);
  const charge = team.deadCap.find((c) => c.seasonsLeft === releasedYears);
  assert(charge, 'expected a dead cap charge for the released player');
  assert.equal(charge.amount, Math.round((releasedSalary / 2) * 100) / 100);
  assert(state.freeAgencyActivity.some((item) => item.type === 'released'));
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

test('a team cannot re-sign a player it released until the following season', () => {
  const state = newEraState();
  startEra(state, 'Test');
  const team = state.teams[0];
  const otherTeam = state.teams[1];
  const player = team.hand[0];
  assert.equal(releasePlayer(state, team.id, player.id).ok, true);
  assert.equal(signFreeAgent(state, player.id, team.id).ok, false);
  assert(state.freeAgents.some((card) => card.id === player.id));

  otherTeam.hand.pop();
  assert.equal(signFreeAgent(state, player.id, otherTeam.id).ok, true);

  const secondPlayer = team.hand[0];
  assert.equal(releasePlayer(state, team.id, secondPlayer.id).ok, true);
  state.season += 1;
  assert.equal(signFreeAgent(state, secondPlayer.id, team.id).ok, true);
});

test('season start rejects partial and over-budget human rosters', () => {
  const state = newEraState();
  const cards = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, position: ['Guard', 'Forward', 'Big'][i % 3], salary: 2 }));
  const team = { id: 0, human: true, hand: cards.slice(0, 8), activeIds: cards.slice(0, 5).map((card) => card.id), seasonCap: 10, coach: { salary: 0 } };
  state.teams = [team];
  assert.match(confirmLineup(state, 0).msg, /8 of 9/);
  team.hand = cards;
  assert.match(confirmLineup(state, 0).msg, /under budget/);
  assert.equal(team.lineupConfirmed, undefined);
});
