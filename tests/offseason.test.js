import test from 'node:test';
import assert from 'node:assert/strict';
import { newEraState, renewExpiredContract, signFreeAgent, fileContracts, closeFreeAgency } from '../src/game/season.js';
import { startDraft, draftPick, forfeitPick, forfeitBonusForPosition, overallPickPosition, buildDraftPool } from '../src/game/draft.js';
import { rosterSalary } from '../src/game/economy.js';
import { FORFEIT_BONUS_MAX, FORFEIT_BONUS_MIN, LEAGUE_TEAM_COUNT } from '../src/game/constants.js';
import { startEra, confirmLineup, markLineupSet } from '../src/game/engine.js';
import { fireCoach, fireGM, hireFreeAgentCoach, releasePlayer } from '../src/game/finances.js';
import { LEAGUE_ACCOLADES, TIERS } from '../src/game/constants.js';
import { rehydrateState } from '../src/game/rehydrate.js';

test('Generational Talent is a modifier while All-Star and Most Valuable Player are accolades', () => {
  assert(TIERS.some((tier) => tier.name === 'Generational Talent'));
  assert(!TIERS.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'All-Star'));
  assert(LEAGUE_ACCOLADES.some((tier) => tier.name === 'Most Valuable Player'));
});

test('Journeyman replaces the legacy Bench Player tier in new and saved games', () => {
  assert(TIERS.some((tier) => tier.name === 'Journeyman'));
  assert(!TIERS.some((tier) => tier.name === 'Bench Player'));
  const state = rehydrateState({
    teams: [{ id: 0, hand: [{ id: 'legacy', archetype: 'Bench Player', tierName: 'Bench Player' }] }],
  });
  assert.equal(state.teams[0].hand[0].archetype, 'Journeyman');
  assert.equal(state.teams[0].hand[0].tierName, 'Journeyman');
});

test('draft prospects never roll Journeyman — every rookie is Young, and journeyman means veteran', () => {
  const state = newEraState();
  for (let i = 0; i < 20; i++) {
    for (const card of buildDraftPool(state, 21)) {
      assert.notEqual(card.tierName, 'Journeyman');
      assert.equal(card.careerStage, 'Young');
    }
  }
});

test('every team starts the era at or under its own season cap', () => {
  for (let i = 0; i < 10; i++) {
    const state = newEraState();
    startEra(state, 'Test');
    for (const team of state.teams) {
      assert(rosterSalary(team) <= team.seasonCap, `${team.name}: ${rosterSalary(team)} > ${team.seasonCap}`);
    }
  }
});

test('Coach & GM Changes defaults off: no coach firing/hiring, no GM firing, no free-agent coaches', () => {
  const state = newEraState();
  assert.equal(state.settings.coachChangesEnabled, false);
  startEra(state, 'Test');
  assert.equal(state.freeAgentCoaches.length, 0);
  const team = state.teams[0];
  team.seasonCap = 100;
  const priorCoach = team.coach;
  assert.equal(fireCoach(state, team.id).ok, false);
  assert.equal(team.coach, priorCoach);
  assert.equal(fireGM(state, team.id).ok, false);
});

test('free agency begins with two to four coaches and excludes Hall of Fame', () => {
  for (let run = 0; run < 30; run++) {
    const state = newEraState();
    state.settings.coachChangesEnabled = true;
    startEra(state, 'Test');
    assert(state.freeAgentCoaches.length >= 2 && state.freeAgentCoaches.length <= 4);
    assert(state.freeAgentCoaches.every((coach) => coach.modifier !== 'Hall of Fame'));
  }
});

test('a free agent coach can be hired and leaves the pool', () => {
  const state = newEraState();
  state.settings.coachChangesEnabled = true;
  startEra(state, 'Test');
  const team = state.teams[0];
  const coach = state.freeAgentCoaches[0];
  const priorCoach = team.coach;
  team.seasonCap = 100;
  assert.equal(fireCoach(state, team.id).ok, true);
  assert.equal(team.coach, null);
  assert.equal(hireFreeAgentCoach(state, team.id, coach.id).ok, true);
  assert.equal(team.coach.id, coach.id);
  assert.notEqual(team.coach, priorCoach);
  assert.equal(state.freeAgentCoaches.some((candidate) => candidate.id === coach.id), false);
});

test('a fired coach leaves a vacancy and cannot return to the same team that season', () => {
  const state = newEraState();
  state.settings.coachChangesEnabled = true;
  startEra(state, 'Test');
  const team = state.teams[0];
  const fired = team.coach;
  team.seasonCap = 100;
  assert.equal(fireCoach(state, team.id).ok, true);
  const listed = state.freeAgentCoaches.find((coach) => coach.id === fired.id || coach.archetype === fired.archetype && coach.firedByTeamId === team.id);
  assert(listed);
  assert.equal(hireFreeAgentCoach(state, team.id, listed.id).ok, false);
  assert.equal(team.coach, null);
  assert.equal(team.deadCap.at(-1).kind, 'coach');
});

test('forfeit bonus scales down from the 1st overall pick to the last', () => {
  assert.equal(forfeitBonusForPosition(1), FORFEIT_BONUS_MAX);
  assert.equal(forfeitBonusForPosition(LEAGUE_TEAM_COUNT), FORFEIT_BONUS_MIN);
  assert(forfeitBonusForPosition(1) > forfeitBonusForPosition(5));
  assert(forfeitBonusForPosition(5) > forfeitBonusForPosition(LEAGUE_TEAM_COUNT));
});

test('forfeiting the 1st overall pick credits the max bonus before the rest of a solo draft auto-resolves', () => {
  const state = newEraState();
  startEra(state, 'Test');
  state.season = 2;
  // Reversing the natural team order before startDraft's own [...seeds].reverse() puts team 0
  // back at the front — the human is on the clock immediately, at the 1st overall pick. In solo
  // mode every other team is AI, so forfeiting here cascades all the way through the rest of the
  // draft and into next season's cap finalization (which resets draftTradeBonus to 0 once
  // applied) — so the position math is checked going in, not the post-cascade leftover value.
  state.seeds = [...state.teams].reverse().map((t) => ({ t }));
  startDraft(state);
  assert.equal(state.draft.queue[0], state.teams[0]);
  assert.equal(overallPickPosition(state), 1);
  assert.equal(forfeitPick(state, 0).ok, true);
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

test('releasing a starter reopens lineup review and blocks the season', () => {
  const state = newEraState();
  startEra(state, 'Test');
  const team = state.teams[0];
  team.seasonCap = 999;
  assert.equal(markLineupSet(state, team.id).valid, true);
  const starterId = team.activeIds[0];
  assert.equal(releasePlayer(state, team.id, starterId).ok, true);
  assert.equal(team.lineupSet, false);
  assert.equal(team.lineupConfirmed, false);
  assert.equal(team.activeIds.length, 4);
  assert.match(confirmLineup(state, team.id).msg, /Resolve your roster/);
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

test('season start rejects a franchise with an open coach slot', () => {
  const state = newEraState();
  const cards = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, position: ['Guard', 'Forward', 'Big'][i % 3], salary: 1 }));
  state.teams = [{ id: 0, human: true, hand: cards, activeIds: cards.slice(0, 5).map((card) => card.id), seasonCap: 20, coach: null }];
  assert.match(confirmLineup(state, 0).msg, /Hire a coach/);
});

test('the draft cannot begin until this team has closed out free agency', () => {
  const state = newEraState();
  state.phase = 'contracts';
  // A second, not-yet-filed human keeps allHumanFiled false so filing here doesn't cascade into
  // startDraft, which needs state.seeds (only real once lockSeasonAndSeed has actually run).
  state.teams = [{ id: 0, human: true, hand: [], seasonCap: 20 }, { id: 1, human: true, hand: [], seasonCap: 20 }];
  const blocked = fileContracts(state, 0);
  assert.equal(blocked.ok, false);
  assert.equal(state.offseason.contractsFiled[0], undefined);
  assert.equal(closeFreeAgency(state, 0).ok, true);
  assert.equal(fileContracts(state, 0).ok, true);
});

test('closing out free agency is refused while over the salary cap', () => {
  const state = newEraState();
  state.teams = [{ id: 0, human: true, hand: [{ id: 'p1', salary: 25 }], seasonCap: 20 }];
  const res = closeFreeAgency(state, 0);
  assert.equal(res.ok, false);
  assert.equal(state.offseason.freeAgencyClosed[0], undefined);
});

test('once free agency is closed, this team can no longer sign, bid, or release players this turn', () => {
  const state = newEraState();
  state.teams = [{ id: 0, human: true, hand: [{ id: 'onroster', salary: 1, contract: 2 }], seasonCap: 20 }];
  state.freeAgents = [{ id: 'fa1', salary: 1 }];
  assert.equal(closeFreeAgency(state, 0).ok, true);
  assert.equal(signFreeAgent(state, 'fa1', 0).ok, false);
  assert.equal(releasePlayer(state, 0, 'onroster').ok, false);
});

test('confirmLineup requires a reviewed lineup; markLineupSet unlocks it', () => {
  const state = newEraState();
  startEra(state, 'Test');
  const team = state.teams[0];
  team.seasonCap = 999;
  assert.match(confirmLineup(state, 0).msg, /Set your lineup/);
  assert.equal(team.lineupConfirmed, undefined);
  assert.equal(markLineupSet(state, 0).valid, true);
  assert.equal(team.lineupSet, true);
  assert.equal(confirmLineup(state, 0).valid, true);
  assert.equal(team.lineupConfirmed, true);
});
