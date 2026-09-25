// Game 2: P2P free-agent bidding — see the design handoff, "Game 2: P2P free-agent bidding".
// A card's priority (Salary/Contract/Winning) and minimums are derived from its own current
// salary/contract rather than stored separately, so nothing has to be written back onto every
// free agent card the moment it enters the pool; freeAgentPriority is a pure, stable function
// of the card's id, so the same card always shows the same priority everywhere it's displayed.
//
// Concurrency model: a session opens the moment any team places an opening bid. Every AI team
// decides its entire opening-and-improvement position in that same instant (see
// resolveAiBidsForSession) — an AI never leaves a session waiting on it. A human bidder stays
// at the 'opening' stage, watching the live offer board, until they raise or stand pat; the
// auction resolves (top three roll off) the moment every bidder still in it has reached
// 'final'. closeFreeAgency (season.js) force-finalizes a team's own dangling opening bids so a
// forgotten tab can't block the league from ever advancing.
import { rollDie } from './rng';
import { remainingCap } from './economy';
import { acquireOffseasonPlayer } from './gm';
import { recordFreeAgencyActivity } from './freeAgencyActivity';
import { cardTotal, neededPosition } from './cards';
import { wasReleasedByTeamThisSeason } from './season';

export const BID_SALARY_STEP = 0.5;
export const BID_PRIORITIES = ['Salary', 'Contract', 'Winning'];
const RESULT_RANK = { MISSED: 0, R1: 1, R2: 2, FINALS: 3, TITLE: 4 };

function round1(n) { return Math.round(n * 2) / 2; }

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Deterministic per card id — the same free agent always prints the same priority, with no
// field to seed or migrate on every card that ever enters state.freeAgents.
export function freeAgentPriority(card) {
  return BID_PRIORITIES[hashSeed(String(card.id)) % BID_PRIORITIES.length];
}

function lastSeasonResult(team) {
  return team.seasonHistory?.at(-1)?.result || 'MISSED';
}

// 0-3 category bonus per the design doc's table. "Reached conference finals" and "won the
// championship" map onto this game's own bracket labels: R2 (lost the semifinal) and FINALS
// (lost the actual Final) both read as "reached the finals-round stage" for this purpose —
// only an outright TITLE earns the top tier.
export function bonusForPriority(priority, team, bidSalary, bidYears, minSalary, minYears) {
  if (priority === 'Salary') {
    const over = round1(bidSalary - minSalary);
    if (over >= 1.5) return 3;
    if (over >= 1.0) return 2;
    if (over >= 0.5) return 1;
    return 0;
  }
  if (priority === 'Contract') {
    const over = bidYears - minYears;
    if (over >= 3) return 3;
    if (over >= 2) return 2;
    if (over >= 1) return 1;
    return 0;
  }
  const result = lastSeasonResult(team);
  if (result === 'TITLE') return 3;
  if (result === 'R2' || result === 'FINALS') return 2;
  if (result === 'R1') return 1;
  return 0;
}

// Every team's total salary already committed to OTHER still-open bids — a team bidding on two
// free agents at once can't count the same cap room twice, even though neither bid has actually
// signed yet. There's no separate hold ledger; this is derived fresh from the live sessions.
export function pendingFaHoldTotal(state, team, excludeCardId) {
  const bidding = state.offseason?.bidding || {};
  let total = 0;
  for (const [cid, session] of Object.entries(bidding)) {
    if (session.status !== 'open' || cid === String(excludeCardId)) continue;
    const bid = session.bids[team.id];
    if (bid) total += bid.salary;
  }
  return round1(total);
}

function validateBid(state, team, session, salary, years) {
  salary = round1(salary);
  years = Math.max(1, Math.min(7, Math.round(years)));
  if (salary < session.minSalary) return { ok: false, msg: `Minimum bid is ${session.minSalary}.` };
  if (years < session.minYears) return { ok: false, msg: `Minimum contract is ${session.minYears} year${session.minYears === 1 ? '' : 's'}.` };
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  const room = remainingCap(team) - pendingFaHoldTotal(state, team, session.cardId);
  if (salary > room) return { ok: false, msg: 'That bid would put you over the cap.' };
  return { ok: true, salary, years };
}

function makeBid(session, team, salary, years, stage) {
  return { salary, years, bonus: bonusForPriority(session.priority, team, salary, years, session.minSalary, session.minYears), stage };
}

function allBidsFinal(session) {
  const bids = Object.values(session.bids);
  return bids.length > 0 && bids.every((b) => b.stage === 'final');
}

// A team wants a card if it's a genuine upgrade over its worst rostered card, or fills a
// position it's short on — the same rough shape as draft.js's bestCardFor, kept deliberately
// simple since this only decides whether/how much an AI bids, not who it drafts.
function aiWantsCard(team, card) {
  if (!team.hand.length) return true;
  if (team.hand.length >= 9) return false;
  const worst = team.hand.reduce((w, c) => (cardTotal(c) < cardTotal(w) ? c : w), team.hand[0]);
  const eager = neededPosition(team) === card.position;
  return cardTotal(card) > cardTotal(worst) * (eager ? 0.75 : 0.95);
}

function resolveAiBidsForSession(state, session, card) {
  state.teams.filter((t) => !t.human).forEach((team) => {
    if (session.bids[team.id]) return;
    if (wasReleasedByTeamThisSeason(card, team, state.season)) return;
    if (!aiWantsCard(team, card)) return;
    const room = remainingCap(team) - pendingFaHoldTotal(state, team, session.cardId);
    if (room < session.minSalary) return;
    const eager = neededPosition(team) === card.position;
    const salary = eager && room >= session.minSalary + BID_SALARY_STEP ? round1(session.minSalary + BID_SALARY_STEP) : session.minSalary;
    session.bids[team.id] = makeBid(session, team, salary, session.minYears, 'final');
  });
}

function cutReason(cutBid, lastFinalist) {
  if (cutBid.bonus !== lastFinalist.bonus) return `${lastFinalist.teamName}'s bonus (+${lastFinalist.bonus}) beat +${cutBid.bonus}.`;
  if (cutBid.salary !== lastFinalist.salary) return `${lastFinalist.teamName}'s ${lastFinalist.salary} salary beat ${cutBid.salary}.`;
  if (cutBid.years !== lastFinalist.years) return `${lastFinalist.teamName}'s ${lastFinalist.years}-year contract beat ${cutBid.years}.`;
  return `${lastFinalist.teamName} won the league tiebreak for the last spot.`;
}

function tiebreakReason(tied) {
  const [a, b] = tied;
  if (a.bonus !== b.bonus) return `Higher bonus wins: +${a.bonus} over +${b.bonus}.`;
  if (a.salary !== b.salary) return `Higher salary wins: ${a.salary} over ${b.salary}.`;
  if (a.years !== b.years) return `Longer contract wins: ${a.years} over ${b.years} years.`;
  return `${a.teamName} wins on last season's finish and the league tiebreak order.`;
}

// Sorts by category bonus, then salary, then years, then previous-season finish, then a stable
// team-id order as the announced league tiebreak — used both to pick the top-three finalists
// and (added to the roll total) to break a tied top roll, exactly as the design doc specifies.
function compareBids(a, b) {
  return (b.bonus - a.bonus) || (b.salary - a.salary) || (b.years - a.years)
    || (RESULT_RANK[lastSeasonResult(b.team)] - RESULT_RANK[lastSeasonResult(a.team)]) || (a.teamId - b.teamId);
}

export function resolveFreeAgentBidding(state, session) {
  session.status = 'resolved';
  const cardIdx = state.freeAgents.findIndex((c) => c.id === session.cardId);
  if (cardIdx < 0) { session.result = { unsigned: true }; return session.result; }

  const bidList = Object.entries(session.bids).map(([tid, bid]) => {
    const team = state.teams.find((t) => t.id === Number(tid));
    return team ? { teamId: team.id, teamName: team.name, team, salary: bid.salary, years: bid.years, bonus: bid.bonus } : null;
  }).filter(Boolean);

  if (bidList.length === 0) { session.result = { unsigned: true }; return session.result; }

  const sorted = [...bidList].sort(compareBids);
  const finalists = sorted.slice(0, 3);
  const cut = sorted.slice(3).map((b) => ({ ...b, reason: cutReason(b, finalists[finalists.length - 1]) }));

  let winner, rolls = [], tiebreak = null, uncontested = false;
  if (finalists.length === 1) {
    winner = finalists[0];
    uncontested = true;
  } else {
    rolls = finalists.map((f) => { const roll = rollDie(10); return { ...f, roll, total: roll + f.bonus }; });
    const byTotal = [...rolls].sort((a, b) => (b.total - a.total) || compareBids(a, b));
    const top = byTotal[0];
    const tiedTop = byTotal.filter((r) => r.total === top.total);
    winner = byTotal[0];
    if (tiedTop.length > 1) tiebreak = tiebreakReason(tiedTop);
  }

  const [rawCard] = state.freeAgents.splice(cardIdx, 1);
  const signed = acquireOffseasonPlayer(winner.team, { ...rawCard, salary: winner.salary, contract: winner.years, maxContract: winner.years });
  recordFreeAgencyActivity(state, 'signed', signed, winner.team);

  session.result = {
    winnerTeamId: winner.teamId, winnerTeamName: winner.teamName,
    salary: winner.salary, years: winner.years,
    finalists, cut, rolls, tiebreak, uncontested, unsigned: false,
  };
  return session.result;
}

function maybeResolveBidding(state, session) {
  if (!allBidsFinal(session)) return { ok: true, session, resolved: false };
  const result = resolveFreeAgentBidding(state, session);
  return { ok: true, session, resolved: true, result };
}

export function openFreeAgentBid(state, teamIdx, cardId, salary, years) {
  const team = state.teams[teamIdx];
  if (!team) return { ok: false, msg: 'Unknown team.' };
  if (state.offseason?.freeAgencyClosed?.[team.id]) return { ok: false, msg: 'You have closed out free agency this turn.' };
  const card = state.freeAgents.find((c) => c.id === cardId);
  if (!card) return { ok: false, msg: 'Card not available.' };
  if (wasReleasedByTeamThisSeason(card, team, state.season)) return { ok: false, msg: 'You cannot re-sign a player you released this season.' };

  state.offseason.bidding ||= {};
  let session = state.offseason.bidding[cardId];
  if (session && session.status !== 'open') return { ok: false, msg: 'Bidding on this player has already closed.' };
  if (!session) {
    session = { cardId, priority: freeAgentPriority(card), minSalary: card.salary, minYears: card.contract, bids: {}, status: 'open' };
    state.offseason.bidding[cardId] = session;
  }
  if (session.bids[team.id]) return { ok: false, msg: 'You already have a bid in on this player — raise it instead.' };
  const check = validateBid(state, team, session, salary, years);
  if (!check.ok) return check;
  session.bids[team.id] = makeBid(session, team, check.salary, check.years, 'opening');
  resolveAiBidsForSession(state, session, card);
  return maybeResolveBidding(state, session);
}

export function raiseFreeAgentBid(state, teamIdx, cardId, salary, years) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.bidding?.[cardId];
  if (!team || !session || session.status !== 'open') return { ok: false, msg: 'No bidding in progress.' };
  const current = session.bids[team.id];
  if (!current || current.stage !== 'opening') return { ok: false, msg: 'You have no open bid to raise.' };
  salary = round1(salary);
  years = Math.max(1, Math.min(7, Math.round(years)));
  if (salary < current.salary || years < current.years) return { ok: false, msg: 'A raise cannot lower salary or years.' };
  if (salary === current.salary && years === current.years) return { ok: false, msg: 'Raise salary, years, or both.' };
  const check = validateBid(state, team, session, salary, years);
  if (!check.ok) return check;
  session.bids[team.id] = makeBid(session, team, check.salary, check.years, 'final');
  return maybeResolveBidding(state, session);
}

export function standPatFreeAgentBid(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const session = state.offseason?.bidding?.[cardId];
  if (!team || !session || session.status !== 'open') return { ok: false, msg: 'No bidding in progress.' };
  const current = session.bids[team.id];
  if (!current || current.stage !== 'opening') return { ok: false, msg: 'No open bid to stand pat on.' };
  current.stage = 'final';
  return maybeResolveBidding(state, session);
}

// Called from closeFreeAgency (season.js) so a team that closes out with a dangling opening bid
// (never came back to raise or stand pat) can't leave every other bidder on that card stuck
// waiting forever — treat the un-acted bid as a stand pat and resolve anything that unblocks.
export function forceFinalizeTeamBids(state, team) {
  Object.values(state.offseason?.bidding || {}).forEach((session) => {
    if (session.status !== 'open') return;
    const bid = session.bids[team.id];
    if (bid && bid.stage === 'opening') bid.stage = 'final';
    if (allBidsFinal(session)) resolveFreeAgentBidding(state, session);
  });
}

// Whether this team has an unresolved bid still waiting on its own raise/stand-pat decision —
// drives the Free Agency nav badge (see Sidebar/Header) so a human doesn't forget to come back.
export function hasPendingBidDecision(state, team) {
  return Object.values(state.offseason?.bidding || {}).some((session) => (
    session.status === 'open' && session.bids[team.id]?.stage === 'opening'
  ));
}
