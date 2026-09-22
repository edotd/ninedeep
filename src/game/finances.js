// Front-office moves — firing a coach or GM, releasing a player, investing in the fanbase —
// spend budget room (this season's unused budget headroom) rather than a separate currency.
// Releasing or firing leaves dead cap behind: half of the outgoing party's cost, charged
// starting this season, for as many seasons as a released player had left on their contract
// (or exactly one season for a coach or GM — they're always fully off the books after that).
// Dead cap counts against the budget every one of those seasons (see economy.js's
// rosterSalary/deadCapDue) — it never adds room, it costs less than keeping the outgoing
// contract would have, but it isn't free. See economy.js's finalizeCap for where these
// charges count down each season transition. Hiring the replacement coach still costs its
// own salary this season on top of the outgoing coach's dead cap.
import { FANBASE_BOOST_COST, FANBASE_BOOST_AMOUNT } from './constants';
import { drawCoachCard } from './cards';
import { rosterSalary, gmCost } from './economy';
import { drawGM } from './gm';
import { recordFreeAgencyActivity } from './freeAgencyActivity';

function budgetRoom(team) {
  return (team.seasonCap || 0) - rosterSalary(team);
}

function addDeadCap(team, amount, seasonsLeft) {
  if (seasonsLeft <= 0) return;
  team.deadCap = team.deadCap || [];
  team.deadCap.push({ amount: Math.round(amount * 100) / 100, seasonsLeft });
}

export function fireCoach(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team.coach) return { ok: false, msg: 'No coach to fire.' };
  const newCoach = drawCoachCard();
  const room = budgetRoom(team);
  if (room < newCoach.salary) return { ok: false, msg: `Not enough budget room — hiring ${newCoach.archetype} costs ${newCoach.salary}, you have ${Math.round(room * 10) / 10}.` };
  addDeadCap(team, team.coach.salary / 2, 1);
  team.coach = newCoach;
  team.retainedStreak = 0;
  team.lastCoachName = newCoach.name;
  return { ok: true };
}

export function fireGM(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team?.market) return { ok: false, msg: 'No GM to fire.' };
  if (team.gmChangeSeason === state.season) return { ok: false, msg: 'GM already replaced this season.' };
  const next = drawGM(team.gmType || 'Neutral');
  const attendanceMult = 0.9 + (team.attendance ?? 0.5) * 0.2;
  const capChange = Math.round((next.market.capAdj - team.market.capAdj) * attendanceMult * 2) / 2;
  addDeadCap(team, gmCost(team.gmType) / 2, 1);
  team.gmType = next.type;
  team.market = next.market;
  team.seasonCap += capChange;
  team.gmChangeSeason = state.season;
  return { ok: true };
}

// Waiving a player — starter or bench: they head to free agency for any other club to sign,
// and (per the salary-cap spec) half their salary becomes dead cap charged every season from
// this one through however many years they had left — a contract already in its last
// contract year (yearsRemaining <= 0, i.e. already expired/EXP) leaves no dead cap at all.
// Releasing an active starter drops activeIds below 5; the chemistry panel's own UI notices
// that and offers promoteToStarter (engine.js) — a direct "fill the open slot" action —
// instead of the outgoing/incoming swap it normally shows, since swapStarter refuses to run
// at all unless activeIds.length === 5.
export function releasePlayer(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const idx = team.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, msg: 'Player not found on this roster.' };
  const card = team.hand[idx];
  team.hand.splice(idx, 1);
  if (team.activeIds) team.activeIds = team.activeIds.filter((id) => id !== cardId);
  addDeadCap(team, card.salary / 2, card.contract);
  const released = Object.assign({}, card, {
    contract: card.maxContract,
    lastTeamId: team.id,
    releasedByTeamId: team.id,
    releasedSeason: state.season,
  });
  state.freeAgents.push(released);
  recordFreeAgencyActivity(state, 'released', released, team);
  return { ok: true };
}

export function investInFanbase(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.financeBoostUsedThisSeason) return { ok: false, msg: 'Already invested in your fanbase this season.' };
  const room = budgetRoom(team);
  if (room < FANBASE_BOOST_COST) return { ok: false, msg: `Not enough budget room — this costs ${FANBASE_BOOST_COST}.` };
  team.seasonCap -= FANBASE_BOOST_COST;
  team.fanbaseBaseline = (team.fanbaseBaseline || 0) + FANBASE_BOOST_AMOUNT;
  team.financeBoostUsedThisSeason = true;
  return { ok: true };
}
