// Front-office moves — firing a coach or GM, investing in the fanbase — spend
// budget room (this season's unused budget headroom) rather than a separate currency. Firing
// a coach charges both the old coach's payout and the new hire's salary as a one-time
// deduction (real dead-cap treatment: you eat the outgoing contract while also taking on the
// incoming one, which then keeps counting against the budget normally via rosterSalary going
// forward).
import {
  FANBASE_BOOST_COST, FANBASE_BOOST_AMOUNT, FIRE_GM_COST,
} from './constants';
import { drawCoachCard } from './cards';
import { rosterSalary } from './economy';
import { drawGM } from './gm';

function budgetRoom(team) {
  return (team.seasonCap || 0) - rosterSalary(team);
}

export function fireCoach(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team.coach) return { ok: false, msg: 'No coach to fire.' };
  const newCoach = drawCoachCard();
  const cost = team.coach.salary + newCoach.salary;
  const room = budgetRoom(team);
  if (room < cost) return { ok: false, msg: `Not enough budget room — this move costs ${cost}, you have ${Math.round(room * 10) / 10}.` };
  team.seasonCap -= cost;
  team.coach = newCoach;
  team.retainedStreak = 0;
  team.lastCoachName = newCoach.name;
  return { ok: true };
}

export function fireGM(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team?.market) return { ok: false, msg: 'No GM to fire.' };
  if (team.gmChangeSeason === state.season) return { ok: false, msg: 'GM already replaced this season.' };
  if (budgetRoom(team) < FIRE_GM_COST) return { ok: false, msg: `Fire GM requires ${FIRE_GM_COST} budget room.` };
  const next = drawGM(team.gmType || 'Neutral');
  const attendanceMult = 0.9 + (team.attendance ?? 0.5) * 0.2;
  const capChange = Math.round((next.market.capAdj - team.market.capAdj) * attendanceMult * 2) / 2;
  team.gmType = next.type;
  team.market = next.market;
  team.seasonCap += capChange - FIRE_GM_COST;
  team.gmChangeSeason = state.season;
  return { ok: true };
}

// Waiving a bench player: their full remaining salary counts as dead money against this
// season's budget (same one-time-deduction treatment as firing a coach), and they head to
// free agency for any other club to sign. Restricted to the bench — cutting an active starter
// would leave a hole in activeIds that the chemistry panel's swap UI can't repair (it swaps an
// existing starter out for a bench player in, not an already-gone id), so a starter has to be
// benched first via swapStarter before they can be released.
export function releasePlayer(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const idx = team.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, msg: 'Player not found on this roster.' };
  if ((team.activeIds || []).includes(cardId)) return { ok: false, msg: 'Bench this player before releasing them.' };
  const card = team.hand[idx];
  const deadMoney = card.salary;
  const room = budgetRoom(team);
  if (room < deadMoney) return { ok: false, msg: `Not enough budget room — releasing ${card.archetype} carries ${deadMoney} in dead money, you have ${Math.round(room * 10) / 10}.` };
  team.hand.splice(idx, 1);
  team.seasonCap -= deadMoney;
  team.deadMoney = (team.deadMoney || 0) + deadMoney;
  state.freeAgents.push(Object.assign({}, card, { contract: card.maxContract, lastTeamId: team.id }));
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
