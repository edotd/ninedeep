// Front-office moves — firing a coach, relocating markets, investing in the fanbase — spend
// cap room (this season's unused cap headroom) rather than a separate currency. Firing a
// coach charges both the old coach's payout and the new hire's salary as a one-time deduction
// (real dead-cap treatment: you eat the outgoing contract while also taking on the incoming
// one, which then keeps counting against the cap normally via rosterSalary going forward).
import {
  RELOCATION_BASE_COST, RELOCATION_PER_TIER_COST, FANBASE_BOOST_COST, FANBASE_BOOST_AMOUNT, MARKETS,
} from './constants';
import { drawCoachCard } from './cards';
import { rollMarketCapAdj, finalizeCap, rosterSalary } from './economy';

function capRoom(team) {
  return (team.seasonCap || 0) - rosterSalary(team);
}

export function fireCoach(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team.coach) return { ok: false, msg: 'No coach to fire.' };
  const newCoach = drawCoachCard();
  const cost = team.coach.salary + newCoach.salary;
  const room = capRoom(team);
  if (room < cost) return { ok: false, msg: `Not enough cap room — this move costs ${cost}, you have ${Math.round(room * 10) / 10}.` };
  team.seasonCap -= cost;
  team.coach = newCoach;
  team.retainedStreak = 0;
  team.lastCoachName = newCoach.name;
  return { ok: true };
}

function marketTierIndex(name) {
  return MARKETS.findIndex((m) => m.name === name);
}
export function relocationCost(team, marketName) {
  const fromIdx = team.market ? marketTierIndex(team.market.name) : 0;
  const toIdx = marketTierIndex(marketName);
  const distance = Math.max(1, Math.abs(toIdx - fromIdx));
  return RELOCATION_BASE_COST + RELOCATION_PER_TIER_COST * distance;
}
export function relocateMarket(state, teamIdx, marketName) {
  const team = state.teams[teamIdx];
  const targetDef = MARKETS.find((m) => m.name === marketName);
  if (!targetDef) return { ok: false, msg: 'Unknown market.' };
  if (team.market && team.market.name === marketName) return { ok: false, msg: 'Already in that market.' };
  const cost = relocationCost(team, marketName);
  const room = capRoom(team);
  if (room < cost) return { ok: false, msg: `Not enough cap room — relocating here costs ${cost}, you have ${Math.round(room * 10) / 10}.` };
  team.market = { name: targetDef.name, capAdj: rollMarketCapAdj(targetDef) };
  // finalizeCap recomputes seasonCap fresh off the new market, so the relocation fee is
  // deducted after — it's a moving expense on top of whatever the new market's cap turns out
  // to be, not a bite out of the old one.
  finalizeCap(team, state.season);
  team.seasonCap -= cost;
  return { ok: true };
}

export function investInFanbase(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.financeBoostUsedThisSeason) return { ok: false, msg: 'Already invested in your fanbase this season.' };
  const room = capRoom(team);
  if (room < FANBASE_BOOST_COST) return { ok: false, msg: `Not enough cap room — this costs ${FANBASE_BOOST_COST}.` };
  team.seasonCap -= FANBASE_BOOST_COST;
  team.fanbaseBaseline = (team.fanbaseBaseline || 0) + FANBASE_BOOST_AMOUNT;
  team.financeBoostUsedThisSeason = true;
  return { ok: true };
}
