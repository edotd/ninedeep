import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freeAgentPriority, bonusForPriority, openFreeAgentBid, raiseFreeAgentBid, standPatFreeAgentBid,
  resolveFreeAgentBidding, forceFinalizeTeamBids, hasPendingBidDecision, pendingFaHoldTotal,
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

test('a single opening bid, once stood pat, signs uncontested with no roll', () => {
  const state = baseState();
  const open = openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(open.ok, true);
  assert.equal(open.resolved, false, 'still waiting on this GM\'s own raise/stand-pat decision');
  const res = standPatFreeAgentBid(state, 0, 'p1');
  assert.equal(res.resolved, true);
  assert.equal(res.result.uncontested, true);
  assert.equal(res.result.winnerTeamId, 0);
  assert.equal(state.teams[0].hand.length, 1);
  assert.equal(state.teams[0].hand[0].salary, 5);
  assert.equal(state.freeAgents.length, 0);
});

test('a raise must improve at least one term and cannot lower either', () => {
  const state = baseState();
  openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(raiseFreeAgentBid(state, 0, 'p1', 5, 2).ok, false);
  assert.equal(raiseFreeAgentBid(state, 0, 'p1', 4.5, 3).ok, false);
  const res = raiseFreeAgentBid(state, 0, 'p1', 5.5, 2);
  assert.equal(res.ok, true);
  assert.equal(res.resolved, true, 'sole bidder resolves the moment they finalize');
});

test('doc worked example: a 0-bonus finalist can beat a +2-bonus finalist on a friendlier roll', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Salary', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 5, years: 2, bonus: 0, stage: 'final' },
      2: { salary: 5.5, years: 2, bonus: 1, stage: 'final' },
      3: { salary: 6, years: 2, bonus: 2, stage: 'final' },
    },
  };
  // Finalists sort by bonus desc: team3 (+2), team2 (+1), team0 (+0) — rolls assigned in that
  // order, so [5, 6, 9] gives totals 7, 7, 9: the 5-cap, 0-bonus bidder wins the upset.
  const result = mockRolls([5, 6, 9], () => resolveFreeAgentBidding(state, session));
  assert.equal(result.winnerTeamId, 0);
  assert.equal(result.salary, 5);
  assert.equal(state.teams[0].hand.some((c) => c.id === 'p1'), true);
  assert.equal(state.freeAgents.length, 0);
});

test('a fourth bid is cut for the top three, released, and given a reason', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Salary', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 6, years: 2, bonus: 2, stage: 'final' },
      1: { salary: 5.5, years: 2, bonus: 1, stage: 'final' },
      2: { salary: 5, years: 3, bonus: 0, stage: 'final' },
      3: { salary: 5, years: 2, bonus: 0, stage: 'final' },
    },
  };
  const result = mockRolls([5, 5, 5], () => resolveFreeAgentBidding(state, session));
  assert.equal(result.finalists.length, 3);
  assert.equal(result.cut.length, 1);
  assert.equal(result.cut[0].teamId, 3, 'shorter contract at the same bonus/salary loses the last spot');
  assert.match(result.cut[0].reason, /contract/i);
});

test('a tied top roll is broken by bonus, then salary, then years, then league order — no reroll', () => {
  const state = baseState();
  const session = {
    cardId: 'p1', priority: 'Salary', minSalary: 5, minYears: 2, status: 'open',
    bids: {
      0: { salary: 6, years: 2, bonus: 2, stage: 'final' },
      1: { salary: 5.5, years: 2, bonus: 1, stage: 'final' },
    },
  };
  const result = mockRolls([6, 7], () => resolveFreeAgentBidding(state, session));
  assert.equal(result.rolls.length, 2);
  const totals = result.rolls.map((r) => r.total);
  assert.deepEqual(totals.sort(), [8, 8]);
  assert.equal(result.winnerTeamId, 0, 'higher bonus wins the exact tie');
  assert(result.tiebreak);
});

test('a lone bidder is uncontested even though the free agent was already reachable to everyone', () => {
  const state = baseState();
  const session = { cardId: 'p1', priority: 'Contract', minSalary: 5, minYears: 2, status: 'open', bids: { 2: { salary: 5, years: 2, bonus: 0, stage: 'final' } } };
  const result = resolveFreeAgentBidding(state, session);
  assert.equal(result.uncontested, true);
  assert.equal(result.winnerTeamId, 2);
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

test('closeFreeAgency\'s force-finalize resolves a dangling opening bid instead of blocking forever', () => {
  const state = baseState();
  openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(hasPendingBidDecision(state, state.teams[0]), true);
  forceFinalizeTeamBids(state, state.teams[0]);
  assert.equal(hasPendingBidDecision(state, state.teams[0]), false);
  assert.equal(state.teams[0].hand.some((c) => c.id === 'p1'), true);
});

test('bidding on a card is blocked once this team has closed out free agency', () => {
  const state = baseState();
  state.offseason.freeAgencyClosed[0] = true;
  const res = openFreeAgentBid(state, 0, 'p1', 5, 2);
  assert.equal(res.ok, false);
});
