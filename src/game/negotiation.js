// Game 1: re-signing negotiation. A human GM negotiates directly with an expiring player's
// agent (no other team involved) — see the design handoff, Nine_Deep_Player_Negotiation_and_
// Bidding_Design.md, "Game 1: Re-signing negotiation". Every session lives at
// state.offseason.negotiations[cardId] and is fully resolved (or abandoned) before the card
// ever leaves state.freeAgents, so it can't collide with someone else's bid on the same card
// (see bidding.js) — an active negotiation simply doesn't stop anyone else from also placing a
// bid; whichever resolves first (sign or a won auction) removes the card for good.
import { rollDie } from './rng';
import { remainingCap } from './economy';
import { acquireOffseasonPlayer } from './gm';
import { recordFreeAgencyActivity } from './freeAgencyActivity';
import { MIN_PLAYER_SALARY } from './constants';

export const SALARY_STEP = 0.5;
export const MAX_NEGOTIATION_ROLLS = 3;
export const NEGOTIATION_BANDS = ['Lowball', 'Discounted', 'Fair', 'Premium'];
const BAND_THRESHOLD = { Lowball: 7, Discounted: 5, Fair: 3, Premium: 2 };

function round1(n) { return Math.round(n * 2) / 2; }

// Salary band against the ask, then dropped one band if the offered term is shorter than
// requested — see the design doc's band table. Longer terms never raise the band by themselves.
export function negotiationBand(askSalary, askYears, offerSalary, offerYears) {
  const diff = round1(offerSalary - askSalary);
  let idx = diff >= 0.5 ? 3 : diff === 0 ? 2 : diff === -0.5 ? 1 : 0;
  if (offerYears < askYears) idx = Math.max(0, idx - 1);
  return NEGOTIATION_BANDS[idx];
}

export function negotiationAcceptThreshold(band) { return BAND_THRESHOLD[band]; }
export function negotiationAcceptChance(band) { return (11 - BAND_THRESHOLD[band]) * 10; }

// If the offer is below ask, the agent counters at the ask (and at least the requested years).
// If it meets/exceeds ask on salary but is short on years, counter at that salary for the
// requested years. Otherwise counter half a point above the current offer. No printed maximum
// salary exists on a card in this game, so the "ask for one more year instead" fallback the
// doc describes for a maxed-out card never actually triggers here.
export function negotiationCounter(ask, offer) {
  if (offer.salary < ask.salary) return { salary: ask.salary, years: Math.max(offer.years, ask.years) };
  if (offer.years < ask.years) return { salary: offer.salary, years: ask.years };
  return { salary: round1(offer.salary + SALARY_STEP), years: offer.years };
}

function findNegotiableCard(state, team, cardId) {
  return state.freeAgents.find((c) => c.id === cardId && c.lastTeamId === team.id);
}

function signCard(state, team, cardId, salary, years) {
  const idx = state.freeAgents.findIndex((c) => c.id === cardId);
  const [card] = state.freeAgents.splice(idx, 1);
  const signed = acquireOffseasonPlayer(team, { ...card, salary, contract: years, maxContract: years, freeAgentSignedSeason: state.season });
  recordFreeAgencyActivity(state, 'signed', signed, team);
  return signed;
}

// Opens (or reopens) a negotiation for one of this team's own expiring players, defaulting the
// first offer to the agent's exact ask — a fair, unremarkable starting point the GM can move
// off of before ever rolling. Doesn't roll by itself; see submitNegotiationOffer.
export function openNegotiation(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'contracts' || !team?.human || state.offseason?.contractsFiled?.[team.id]) {
    return { ok: false, msg: 'Contract decisions are closed.' };
  }
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  state.offseason.negotiations ||= {};
  const existing = state.offseason.negotiations[cardId];
  if (existing && existing.status === 'active') return { ok: true, session: existing };
  const card = findNegotiableCard(state, team, cardId);
  if (!card) return { ok: false, msg: 'Player is not available for renewal.' };
  const session = {
    cardId,
    teamId: team.id,
    askSalary: card.salary,
    askYears: card.maxContract,
    minSalary: Math.max(MIN_PLAYER_SALARY, round1(card.salary - 1)),
    offer: { salary: card.salary, years: card.maxContract },
    rollsUsed: 0,
    history: [],
    pendingCounter: null,
    status: 'active',
  };
  state.offseason.negotiations[cardId] = session;
  return { ok: true, session };
}

// Submits an offer and immediately rolls against it — the design's own R1->R2 beat is one
// screen and one button ("Roll the D10"), so building the offer and resolving it are one action.
export function submitNegotiationOffer(state, teamIdx, cardId, salary, years) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.negotiations?.[cardId];
  if (!session || session.teamId !== team?.id || session.status !== 'active') {
    return { ok: false, msg: 'No negotiation in progress.' };
  }
  if (session.rollsUsed >= MAX_NEGOTIATION_ROLLS) {
    return { ok: false, msg: 'No rolls remaining — accept the counter or let him walk.' };
  }
  salary = round1(salary);
  years = Math.max(1, Math.min(7, Math.round(years)));
  if (salary < session.minSalary) return { ok: false, msg: `Offers below ${session.minSalary} are not permitted.` };
  if (session.pendingCounter) {
    const floor = session.offer;
    if (salary < floor.salary || years < floor.years) return { ok: false, msg: 'You cannot lower salary or years after a counter.' };
    if (salary === floor.salary && years === floor.years) return { ok: false, msg: 'Raise at least one term to roll again.' };
  }
  if (salary > remainingCap(team)) return { ok: false, msg: 'That offer would put you over the cap.' };

  const ask = { salary: session.askSalary, years: session.askYears };
  const offer = { salary, years };
  const band = negotiationBand(ask.salary, ask.years, offer.salary, offer.years);
  const threshold = BAND_THRESHOLD[band];
  const roll = rollDie(10);
  session.rollsUsed += 1;
  session.offer = offer;

  let result = 'counters';
  if (roll >= threshold) result = 'signed';
  else if (band === 'Lowball' && roll <= 2) result = 'walks';

  session.history.push({ salary, years, band, threshold, roll, result });

  if (result === 'signed') {
    signCard(state, team, cardId, salary, years);
    session.status = 'signed';
    session.pendingCounter = null;
  } else if (result === 'walks') {
    session.status = 'walked';
    session.pendingCounter = null;
  } else {
    session.pendingCounter = { ...negotiationCounter(ask, offer), final: session.rollsUsed >= MAX_NEGOTIATION_ROLLS };
  }
  return { ok: true, result, band, threshold, roll, session };
}

export function acceptNegotiationCounter(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.negotiations?.[cardId];
  if (!session || session.teamId !== team?.id || session.status !== 'active' || !session.pendingCounter) {
    return { ok: false, msg: 'No counter to accept.' };
  }
  const { salary, years } = session.pendingCounter;
  if (salary > remainingCap(team)) {
    return { ok: false, msg: `Not enough budget room. You need ${round1(salary - remainingCap(team))} more.` };
  }
  signCard(state, team, cardId, salary, years);
  session.status = 'signed';
  session.offer = { salary, years };
  session.pendingCounter = null;
  return { ok: true, session };
}

export function walkAwayFromNegotiation(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.negotiations?.[cardId];
  if (!session || session.teamId !== team?.id || session.status !== 'active') {
    return { ok: false, msg: 'No negotiation in progress.' };
  }
  session.status = 'walked';
  session.pendingCounter = null;
  return { ok: true, session };
}
