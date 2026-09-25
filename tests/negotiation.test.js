import test from 'node:test';
import assert from 'node:assert/strict';
import {
  negotiationBand, negotiationCounter, openNegotiation, submitNegotiationOffer,
  acceptNegotiationCounter, walkAwayFromNegotiation, MAX_NEGOTIATION_ROLLS,
} from '../src/game/negotiation.js';

function baseState() {
  return {
    phase: 'contracts',
    season: 1,
    offseason: { contractsFiled: {} },
    teams: [{ id: 0, human: true, hand: [], seasonCap: 20 }],
    freeAgents: [{ id: 'p1', lastTeamId: 0, salary: 5, contract: 3, maxContract: 3, archetype: 'Okonkwo', position: 'Guard' }],
    freeAgencyActivity: [],
  };
}

function mockRoll(n, fn) {
  const original = Math.random;
  Math.random = () => (n - 1) / 10;
  try { return fn(); } finally { Math.random = original; }
}

test('negotiationBand matches the design doc\'s salary table and the years drop-one-band rule', () => {
  assert.equal(negotiationBand(5, 3, 4, 3), 'Lowball');
  assert.equal(negotiationBand(5, 3, 4.5, 3), 'Discounted');
  assert.equal(negotiationBand(5, 3, 5, 3), 'Fair');
  assert.equal(negotiationBand(5, 3, 5.5, 3), 'Premium');
  // Shorter term drops the band once; Lowball stays Lowball.
  assert.equal(negotiationBand(5, 3, 5.5, 2), 'Fair');
  assert.equal(negotiationBand(5, 3, 5, 2), 'Discounted');
  assert.equal(negotiationBand(5, 3, 4, 2), 'Lowball');
});

test('negotiationCounter follows the doc\'s three generation rules', () => {
  assert.deepEqual(negotiationCounter({ salary: 5, years: 3 }, { salary: 4.5, years: 3 }), { salary: 5, years: 3 });
  assert.deepEqual(negotiationCounter({ salary: 5, years: 3 }, { salary: 5, years: 2 }), { salary: 5, years: 3 });
  assert.deepEqual(negotiationCounter({ salary: 5, years: 3 }, { salary: 5.5, years: 3 }), { salary: 6, years: 3 });
});

test('the design doc\'s worked example: discounted offer counters, improved offer signs', () => {
  const state = baseState();
  assert.equal(openNegotiation(state, 0, 'p1').ok, true);
  const r1 = mockRoll(3, () => submitNegotiationOffer(state, 0, 'p1', 4.5, 3));
  assert.equal(r1.result, 'counters');
  assert.equal(r1.band, 'Discounted');
  assert.deepEqual(state.offseason.negotiations.p1.pendingCounter, { salary: 5, years: 3, final: false });

  const r2 = mockRoll(4, () => submitNegotiationOffer(state, 0, 'p1', 5, 3));
  assert.equal(r2.result, 'signed');
  assert.equal(r2.band, 'Fair');
  assert.equal(state.teams[0].hand.length, 1);
  assert.equal(state.teams[0].hand[0].salary, 5);
  assert.equal(state.teams[0].hand[0].contract, 3);
  assert.equal(state.freeAgents.length, 0);
});

test('a lowball offer that rolls 1 or 2 walks immediately, however many rolls are left', () => {
  const state = baseState();
  openNegotiation(state, 0, 'p1');
  const r = mockRoll(2, () => submitNegotiationOffer(state, 0, 'p1', 4, 3));
  assert.equal(r.result, 'walks');
  assert.equal(state.offseason.negotiations.p1.status, 'walked');
  assert.equal(state.teams[0].hand.length, 0);
  assert.equal(state.freeAgents.length, 1, 'the player stays in the pool for free agency bidding');
});

test('after the third failed roll the counter is final and no fourth roll is allowed', () => {
  const state = baseState();
  openNegotiation(state, 0, 'p1');
  mockRoll(3, () => submitNegotiationOffer(state, 0, 'p1', 4.5, 3)); // Discounted, fails -> counters 5x3
  mockRoll(2, () => submitNegotiationOffer(state, 0, 'p1', 5, 3)); // Fair, fails -> counters 5.5x3
  const r3 = mockRoll(1, () => submitNegotiationOffer(state, 0, 'p1', 5.5, 3)); // Premium, fails -> final counter
  assert.equal(r3.result, 'counters');
  assert.equal(state.offseason.negotiations.p1.rollsUsed, MAX_NEGOTIATION_ROLLS);
  assert.equal(state.offseason.negotiations.p1.pendingCounter.final, true);
  assert.deepEqual(state.offseason.negotiations.p1.pendingCounter, { salary: 6, years: 3, final: true });
  const blocked = submitNegotiationOffer(state, 0, 'p1', 6, 3);
  assert.equal(blocked.ok, false);
});

test('accepting a counter that would blow the cap is rejected without signing anyone', () => {
  const state = baseState();
  state.teams[0].seasonCap = 4.5;
  openNegotiation(state, 0, 'p1');
  mockRoll(3, () => submitNegotiationOffer(state, 0, 'p1', 4.5, 3));
  const res = acceptNegotiationCounter(state, 0, 'p1');
  assert.equal(res.ok, false);
  assert.equal(state.teams[0].hand.length, 0);
  assert.equal(state.freeAgents.length, 1);
});

test('a GM can walk away from a live counter instead of accepting or improving', () => {
  const state = baseState();
  openNegotiation(state, 0, 'p1');
  mockRoll(3, () => submitNegotiationOffer(state, 0, 'p1', 4.5, 3));
  assert.equal(walkAwayFromNegotiation(state, 0, 'p1').ok, true);
  assert.equal(state.offseason.negotiations.p1.status, 'walked');
});

test('an offer cannot lower salary or years after a counter is on the table', () => {
  const state = baseState();
  openNegotiation(state, 0, 'p1');
  mockRoll(3, () => submitNegotiationOffer(state, 0, 'p1', 4.5, 3));
  const res = submitNegotiationOffer(state, 0, 'p1', 4, 3);
  assert.equal(res.ok, false);
});
