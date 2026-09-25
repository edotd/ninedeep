// Public, asynchronous free-agent bidding. Offers remain open until every human GM closes
// free agency. Exact terms live in shared game state for server-side resolution, while the UI
// only reveals a team's own terms; opponents see that an opening/final offer exists.
import { rollDie } from './rng';
import { remainingCap } from './economy';
import { acquireOffseasonPlayer } from './gm';
import { recordFreeAgencyActivity } from './freeAgencyActivity';
import { cardTotal, neededPosition } from './cards';
import { teamOutput } from './matchup';
import { wasReleasedByTeamThisSeason } from './season';

export const BID_SALARY_STEP = 0.5;
export const BID_PRIORITIES = ['Salary', 'Contract', 'Winning'];
const RESULT_BONUS = { MISSED: 0, R1: 1, R2: 2, FINALS: 2.5, TITLE: 3 };

function round1(n) { return Math.round(n * 2) / 2; }
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// New cards carry their rolled value. The stable fallback keeps older saves compatible.
export function freeAgentPriority(card) {
  return card.freeAgentPriority || BID_PRIORITIES[hashSeed(String(card.id)) % BID_PRIORITIES.length];
}

function lastSeasonResult(team) { return team.seasonHistory?.at(-1)?.result || null; }

export function currentProjectedOutput(team) {
  if (!team?.coach || !team.activeIds?.length) return 0;
  try { return teamOutput(team).total || 0; } catch { return 0; }
}

// Winning considers today's roster. After season one, the latest postseason adds a modest
// track-record bonus, so present quality and demonstrated success both matter.
export function winningValue(team) {
  const result = lastSeasonResult(team);
  return Math.round((currentProjectedOutput(team) + (result ? RESULT_BONUS[result] || 0 : 0)) * 100) / 100;
}

export function bonusForPriority(priority, team, bidSalary, bidYears, minSalary, minYears) {
  if (priority === 'Salary') {
    const over = round1(bidSalary - minSalary);
    if (over >= 1.5) return 3;
    if (over >= 1) return 2;
    if (over >= 0.5) return 1;
    return 0;
  }
  if (priority === 'Contract') return Math.min(3, Math.max(0, bidYears - minYears));
  return RESULT_BONUS[lastSeasonResult(team)] || 0;
}

export function pendingFaHoldTotal(state, team, excludeCardId) {
  let total = 0;
  for (const [cardId, session] of Object.entries(state.offseason?.bidding || {})) {
    if (session.status !== 'open' || cardId === String(excludeCardId)) continue;
    const bid = session.bids[team.id];
    if (bid) total += bid.salary;
  }
  return round1(total);
}

function pendingBidCount(state, team, excludeCardId) {
  return Object.entries(state.offseason?.bidding || {}).filter(([cardId, session]) => (
    session.status === 'open' && cardId !== String(excludeCardId) && session.bids[team.id]
  )).length;
}

function validateBid(state, team, session, salary, years) {
  salary = round1(salary);
  years = Math.max(1, Math.min(7, Math.round(years)));
  if (salary < session.minSalary) return { ok: false, msg: `Minimum bid is ${session.minSalary}.` };
  if (years < session.minYears) return { ok: false, msg: `Minimum contract is ${session.minYears} year${session.minYears === 1 ? '' : 's'}.` };
  if (team.hand.length + pendingBidCount(state, team, session.cardId) >= 9) return { ok: false, msg: 'You have no uncommitted roster spots.' };
  const room = remainingCap(team) - pendingFaHoldTotal(state, team, session.cardId);
  if (salary > room) return { ok: false, msg: 'That bid would put you over the cap.' };
  return { ok: true, salary, years };
}

function makeBid(session, team, salary, years, stage) {
  return { salary, years, bonus: bonusForPriority(session.priority, team, salary, years, session.minSalary, session.minYears), winningValue: winningValue(team), stage };
}

function aiWantsCard(team, card) {
  if (!team.hand.length) return true;
  if (team.hand.length >= 9) return false;
  const worst = team.hand.reduce((w, c) => (cardTotal(c) < cardTotal(w) ? c : w), team.hand[0]);
  const eager = neededPosition(team) === card.position;
  return cardTotal(card) > cardTotal(worst) * (eager ? 0.75 : 0.95);
}

function resolveAiBidsForSession(state, session, card) {
  state.teams.filter((team) => !team.human).forEach((team) => {
    if (session.bids[team.id] || wasReleasedByTeamThisSeason(card, team, state.season) || !aiWantsCard(team, card)) return;
    const room = remainingCap(team) - pendingFaHoldTotal(state, team, session.cardId);
    if (room < session.minSalary || team.hand.length + pendingBidCount(state, team, session.cardId) >= 9) return;
    const eager = neededPosition(team) === card.position;
    const salary = eager && room >= session.minSalary + BID_SALARY_STEP ? round1(session.minSalary + BID_SALARY_STEP) : session.minSalary;
    session.bids[team.id] = makeBid(session, team, salary, session.minYears, 'final');
  });
}

function priorityComparison(priority, a, b) {
  if (priority === 'Contract') return (b.years - a.years) || (b.salary - a.salary);
  if (priority === 'Winning') return (b.winningValue - a.winningValue) || (b.salary - a.salary) || (b.years - a.years);
  return (b.salary - a.salary) || (b.years - a.years);
}

export function resolveFreeAgentBidding(state, session) {
  if (session.status === 'resolved') return session.result;
  session.status = 'resolved';
  const cardIdx = state.freeAgents.findIndex((card) => card.id === session.cardId);
  if (cardIdx < 0) return (session.result = { unsigned: true });
  const bids = Object.entries(session.bids).map(([teamId, bid]) => {
    const team = state.teams.find((candidate) => candidate.id === Number(teamId));
    return team ? { ...bid, winningValue: winningValue(team), team, teamId: team.id, teamName: team.name, stage: 'final' } : null;
  }).filter((bid) => bid && bid.team.hand.length < 9 && bid.salary <= remainingCap(bid.team) - pendingFaHoldTotal(state, bid.team, session.cardId));
  if (!bids.length) return (session.result = { unsigned: true });

  const sorted = [...bids].sort((a, b) => priorityComparison(session.priority, a, b));
  const best = sorted[0];
  const tied = sorted.filter((bid) => priorityComparison(session.priority, best, bid) === 0);
  let winner = best;
  let rolls = [];
  if (tied.length > 1) {
    rolls = tied.map((bid) => ({ ...bid, roll: rollDie(10) }));
    let leaders = rolls;
    while (leaders.length > 1) {
      const high = Math.max(...leaders.map((bid) => bid.roll));
      leaders = leaders.filter((bid) => bid.roll === high);
      if (leaders.length > 1) leaders.forEach((bid) => { bid.roll = rollDie(10); });
    }
    winner = leaders[0];
  }

  const [rawCard] = state.freeAgents.splice(cardIdx, 1);
  const signed = acquireOffseasonPlayer(winner.team, { ...rawCard, salary: winner.salary, contract: winner.years, maxContract: winner.years });
  recordFreeAgencyActivity(state, 'signed', signed, winner.team);
  return (session.result = {
    winnerTeamId: winner.teamId, winnerTeamName: winner.teamName, salary: winner.salary, years: winner.years,
    priority: session.priority,
    rolls: rolls.map(({ teamId, teamName, roll }) => ({ teamId, teamName, roll })),
    tied: tied.length > 1, uncontested: bids.length === 1, unsigned: false,
  });
}

export function resolveAllFreeAgentBidding(state) {
  Object.values(state.offseason?.bidding || {}).forEach((session) => {
    if (session.status !== 'open') return;
    Object.values(session.bids).forEach((bid) => { bid.stage = 'final'; });
    resolveFreeAgentBidding(state, session);
  });
}

export function openFreeAgentBid(state, teamIdx, cardId, salary, years) {
  const team = state.teams[teamIdx];
  if (!team) return { ok: false, msg: 'Unknown team.' };
  if (state.offseason?.freeAgencyClosed?.[team.id]) return { ok: false, msg: 'You have closed out free agency this turn.' };
  const card = state.freeAgents.find((candidate) => candidate.id === cardId);
  if (!card) return { ok: false, msg: 'Card not available.' };
  if (wasReleasedByTeamThisSeason(card, team, state.season)) return { ok: false, msg: 'You cannot re-sign a player you released this season.' };
  state.offseason.bidding ||= {};
  let session = state.offseason.bidding[cardId];
  if (!session) {
    session = { cardId, priority: freeAgentPriority(card), minSalary: card.salary, minYears: card.contract, bids: {}, status: 'open' };
    state.offseason.bidding[cardId] = session;
  }
  if (session.status !== 'open') return { ok: false, msg: 'Bidding on this player has already closed.' };
  if (session.bids[team.id]) return { ok: false, msg: 'You already have a bid in on this player — raise it instead.' };
  const check = validateBid(state, team, session, salary, years);
  if (!check.ok) return check;
  session.bids[team.id] = makeBid(session, team, check.salary, check.years, 'opening');
  resolveAiBidsForSession(state, session, card);
  return { ok: true, session, resolved: false };
}

export function raiseFreeAgentBid(state, teamIdx, cardId, salary, years) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.bidding?.[cardId];
  if (!team || !session || session.status !== 'open') return { ok: false, msg: 'No bidding in progress.' };
  if (state.offseason?.freeAgencyClosed?.[team.id]) return { ok: false, msg: 'You have closed out free agency this turn.' };
  const current = session.bids[team.id];
  if (!current || current.stage !== 'opening') return { ok: false, msg: 'You have no open bid to raise.' };
  salary = round1(salary);
  years = Math.max(1, Math.min(7, Math.round(years)));
  if (salary < current.salary || years < current.years) return { ok: false, msg: 'A raise cannot lower salary or years.' };
  if (salary === current.salary && years === current.years) return { ok: false, msg: 'Raise salary, years, or both.' };
  const check = validateBid(state, team, session, salary, years);
  if (!check.ok) return check;
  session.bids[team.id] = makeBid(session, team, check.salary, check.years, 'final');
  return { ok: true, session, resolved: false };
}

export function standPatFreeAgentBid(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.bidding?.[cardId];
  if (!team || !session || session.status !== 'open') return { ok: false, msg: 'No bidding in progress.' };
  if (state.offseason?.freeAgencyClosed?.[team.id]) return { ok: false, msg: 'You have closed out free agency this turn.' };
  const current = session.bids[team.id];
  if (!current || current.stage !== 'opening') return { ok: false, msg: 'No open bid to stand pat on.' };
  current.stage = 'final';
  return { ok: true, session, resolved: false };
}

export function forceFinalizeTeamBids(state, team) {
  Object.values(state.offseason?.bidding || {}).forEach((session) => {
    const bid = session.status === 'open' && session.bids[team.id];
    if (bid) bid.stage = 'final';
  });
}

export function hasPendingBidDecision(state, team) {
  return Object.values(state.offseason?.bidding || {}).some((session) => session.status === 'open' && session.bids[team.id]?.stage === 'opening');
}
