import test from 'node:test';
import assert from 'node:assert/strict';
import { newEraState, renewExpiredContract } from '../src/game/season.js';
import { startDraft, draftPick } from '../src/game/draft.js';
import { startEra, proceedFromCardOverview, proceedFromHand, proceedToSeason1, confirmLineup } from '../src/game/engine.js';
import { releasePlayer } from '../src/game/finances.js';
import { LEAGUE_ACCOLADES, TIERS } from '../src/game/constants.js';

test('Generational Talent is a modifier while All-Star and Most Valuable Player are accolades', () => {
  assert(TIERS.some((tier) => tier.name === 'Generational Talent'));
  assert(!TIERS.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'Most Valuable Player'));
});

test('every team drafts a Young non-accolade player and resolves an oversized roster on Team', () => {
  const state = newEraState();
  startEra(state, 'Test');
  proceedFromCardOverview(state);
  proceedFromHand(state);
  proceedToSeason1(state);
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
  const releasedSalary = team.hand[9].salary;
  assert.equal(releasePlayer(state, 0, team.hand[9].id).ok, true);
  assert.equal(team.hand.length, 9);
  assert.equal(team.deadMoney, releasedSalary);
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
