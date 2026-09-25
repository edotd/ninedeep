import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freeAgentPriority, bonusForPriority, openFreeAgentBid, raiseFreeAgentBid, standPatFreeAgentBid,
  resolveFreeAgentBidding, resolveAllFreeAgentBidding, forceFinalizeTeamBids, hasPendingBidDecision, pendingFaHoldTotal, winningValue,
} from '../src/game/bidding.js';

// Nine full bench slots so aiWantsCard's early "roster full" check keeps every AI team out of
// these tests without needing real stats on each filler card.
const fullHand = () => Array.from({ length: 9 }, (_, i) => ({ id: `filler-${i}`, position: 'Guard' }));

function baseState() {
  return {
    season: 1,
    offseason: { freeAgencyClosed: {}, bidding: {} },
    teams: [
      { id: 0, human: true, name: 'You', hand: [], seasonCap: 20, seasonHistory: [] },
      { id: 1, human: false, name: 'Rival AI', hand: fullHand(), seasonCap: 20, seasonHistory: [] },
      { id: 2, human: true, name: 'Second Human', hand: [], seasonCap: 20, seasonHistory: [] },
      { id: 3, human: true, name: 'Third Human', hand: [], seasonCap: 20, seasonHistory: [] },
    ],
    freeAgents: [{ id: 'p1', salary: 5, contract: 2, maxContract: 2, archetype: 'Reyes', position: 'Guard' }],
    freeAgencyActivity: [],
  };
}

function mockRolls(seq, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => (seq[i++ % seq.length] - 1) / 10;
  try { return fn(); } finally { Math.random = original; }
}

test('freeAgentPriority is stable for a given card id', () => {
  const a = freeAgentPriority({ id: 'stable-id-1' });
  const b = freeAgentPriority({ id: 'stable-id-1' });
  assert.equal(a, b);
  assert(['Salary', 'Contract', 'Winning'].includes(a));
});

test('bonusForPriority matches the design doc\'s 0-3 category table', () => {
  assert.equal(bonusForPriority('Salary', {}, 5, 2, 5, 2), 0);
  assert.equal(bonusForPriority('Salary', {}, 5.5, 2, 5, 2), 1);
  assert.equal(bonusForPriority('Salary', {}, 6, 2, 5, 2), 2);
  assert.equal(bonusForPriority('Salary', {}, 6.5, 2, 5, 2), 3);
  assert.equal(bonusForPriority('Salary', {}, 8, 2, 5, 2), 3);

  assert.equal(bonusForPriority('Contract', {}, 5, 2, 5, 2), 0);
  assert.equal(bonusForPriority('Contract', {}, 5, 3, 5, 2), 1);
  assert.equal(bonusForPriority('Contract', {}, 5, 4, 5, 2), 2);
  assert.equal(bonusForPriority('Contract', {}, 5, 5, 5, 2), 3);

  const missed = { seasonHistory: [{ result: 'MISSED' }] };
  const madePlayoffs = { seasonHistory: [{ result: 'R1' }] };
  const confFinals = { seasonHistory: [{ result: 'R2' }] };
  const champion = { seasonHistory: [{ result: 'TITLE' }] };
  assert.equal(bonusForPriority('Winning', missed, 5, 2, 5, 2), 0);
  assert.equal(bonusForPriority('Winning', madePlayoffs, 5, 2, 5, 2), 1);
  assert.equal(bonusForPriority('Winning', confFinals, 5, 2, 5, 2), 2);
  assert.equal(bonusForPriority('Winning', champion, 5, 2, 5, 2), 3);
});

test('Winning value uses current projected output and adds the prior-season result after year one', () => {
  const hand = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`, position: ['Guard', 'Forward', 'Big'][i % 3], stats: { SCO: 10, PLM: 10, REB: 10, DEF: 10 },
    salary: 1, careerStage: 'Prime', skillsetId: null,
  }));
  const team = {
    id: 0, hand, activeIds: hand.slice(0, 5).map((card) => card.id),
    coach: { offBonus: 0, defBonus: 0, offDie: 6, defDie: 6 },
    matchupCards: [], seasonGameplanEffects: {}, retainedStreak: 0, seasonHistory: [],
  };
  const firstSeasonValue = winningValue(team);
  assert(firstSeasonValue > 0);
  team.seasonHistory.push({ result: 'TITLE' });
  assert.equal(winningValue(team), firstSeasonValue + 3);
});

test('a final bid remains open until the league closes free agency', () => {
  const state = baseState();
  const open = openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(open.ok, true);
  assert.equal(open.resolved, false);
  const res = standPatFreeAgentBid(state, 0, 'p1');
  assert.equal(res.resolved, false);
  assert.equal(state.freeAgents.length, 1);
  resolveAllFreeAgentBidding(state);
  assert.equal(state.offseason.bidding.p1.result.uncontested, true);
  assert.equal(state.offseason.bidding.p1.result.winnerTeamId, 0);
  assert.equal(state.teams[0].hand.length, 1);
  assert.equal(state.freeAgents.length, 0);
});

test('a raise must improve at least one term and cannot lower either', () => {
  const state = baseState();
  openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(raiseFreeAgentBid(state, 0, 'p1', 5, 2).ok, false);
  assert.equal(raiseFreeAgentBid(state, 0, 'p1', 4.5, 3).ok, false);
  const res = raiseFreeAgentBid(state, 0, 'p1', 5.5, 2);
  assert.equal(res.ok, true);
  assert.equal(res.resolved, false);
  assert.equal(state.offseason.bidding.p1.bids[0].stage, 'final');
});

test('the best salary offer wins without a roll', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Salary', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 5, years: 2, bonus: 0, stage: 'final' },
      2: { salary: 5.5, years: 2, bonus: 1, stage: 'final' },
      3: { salary: 6, years: 2, bonus: 2, stage: 'final' },
    },
  };
  const result = resolveFreeAgentBidding(state, session);
  assert.equal(result.winnerTeamId, 3);
  assert.equal(result.salary, 6);
  assert.equal(result.rolls.length, 0);
});

test('contract-first players prefer years, then salary', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Contract', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 6, years: 2, bonus: 2, stage: 'final' },
      1: { salary: 5.5, years: 2, bonus: 1, stage: 'final' },
      2: { salary: 5, years: 3, bonus: 0, stage: 'final' },
      3: { salary: 5, years: 2, bonus: 0, stage: 'final' },
    },
  };
  const result = resolveFreeAgentBidding(state, session);
  assert.equal(result.winnerTeamId, 2);
  assert.equal(result.years, 3);
});

test('exactly tied best offers roll a d10 and the high roll wins', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Salary', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 6, years: 2, bonus: 2, stage: 'final' },
      2: { salary: 6, years: 2, bonus: 2, stage: 'final' },
    },
  };
  const result = mockRolls([4, 9], () => resolveFreeAgentBidding(state, session));
  assert.equal(result.rolls.length, 2);
  assert.equal(result.winnerTeamId, 2);
  assert.equal(result.tied, true);
});

test('a lone bidder is uncontested even though the free agent was already reachable to everyone', () => {
  const state = baseState();
  const session = { cardId: 'p1', priority: 'Contract', minSalary: 5, minYears: 2, status: 'open', bids: { 2: { salary: 5, years: 2, bonus: 0, stage: 'final' } } };
  const result = resolveFreeAgentBidding(state, session);
  assert.equal(result.uncontested, true);
  assert.equal(result.winnerTeamId, 2);
});

test('a full human roster can bid and carry the winner as a tenth player', () => {
  const state = baseState();
  state.teams[0].hand = fullHand().map((card) => ({ ...card, salary: 0 }));
  assert.equal(openFreeAgentBid(state, 0, 'p1', 5, 2).ok, true);
  standPatFreeAgentBid(state, 0, 'p1');
  resolveAllFreeAgentBidding(state);
  assert.equal(state.teams[0].hand.length, 10);
  assert.equal(state.teams[0].hand.find((card) => card.id === 'p1').freeAgentSignedSeason, 1);
});

test('a team cannot double-count cap room across two simultaneous open bids', () => {
  const state = baseState();
  state.freeAgents.push({ id: 'p2', salary: 15, contract: 2, maxContract: 2, archetype: 'Second', position: 'Forward' });
  state.teams[0].seasonCap = 16;
  assert.equal(openFreeAgentBid(state, 0, 'p1', 5, 2).ok, true);
  assert.equal(pendingFaHoldTotal(state, state.teams[0], 'p2'), 5);
  const res = openFreeAgentBid(state, 0, 'p2', 12, 2);
  assert.equal(res.ok, false, 'p1\'s held 5 plus this 12 would exceed the 16 cap');
});

test('closing a team finalizes its opening bid without resolving the league early', () => {
  const state = baseState();
  openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(hasPendingBidDecision(state, state.teams[0]), true);
  forceFinalizeTeamBids(state, state.teams[0]);
  assert.equal(hasPendingBidDecision(state, state.teams[0]), false);
  assert.equal(state.teams[0].hand.some((c) => c.id === 'p1'), false);
  assert.equal(state.offseason.bidding.p1.status, 'open');
});

test('bidding on a card is blocked once this team has closed out free agency', () => {
  const state = baseState();
  state.offseason.freeAgencyClosed[0] = true;
  const res = openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(res.ok, false);
});
