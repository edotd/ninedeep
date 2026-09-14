// Team Finances — a currency separate from the salary cap. Cap money buys the roster;
// finances buy front-office moves (firing a coach, relocating markets, investing in the
// fanbase). Funded by a flat per-season stipend plus income scaled off last season's
// attendance, so a winning, well-attended team can afford to move faster.
import {
  FINANCE_SEASON_STIPEND, FINANCE_ATTENDANCE_INCOME_RATE, FINANCE_RELOCATION_BASE,
  FINANCE_RELOCATION_PER_TIER, FINANCE_FANBASE_BOOST_COST, FINANCE_FANBASE_BOOST_AMOUNT, MARKETS,
} from './constants';
import { drawCoachCard } from './cards';
import { rollMarketCapAdj, finalizeCap } from './economy';

export function accrueSeasonFinances(team) {
  const attendanceIncome = Math.round((team.attendance !== undefined ? team.attendance : 0.5) * FINANCE_ATTENDANCE_INCOME_RATE);
  team.finances = (team.finances || 0) + FINANCE_SEASON_STIPEND + attendanceIncome;
}

// Flat buyout: pay off the fired coach's salary and the new hire's salary in one shot, then
// draw a fresh coach at random — no guaranteed upgrade, same pool everyone else pulls from.
export function fireCoach(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team.coach) return { ok: false, msg: 'No coach to fire.' };
  const newCoach = drawCoachCard();
  const cost = team.coach.salary + newCoach.salary;
  if ((team.finances || 0) < cost) return { ok: false, msg: `Not enough finances — this move costs ${cost}, you have ${team.finances || 0}.` };
  team.finances -= cost;
  team.coach = newCoach;
  team.retainedStreak = 0;
  team.lastCoachName = newCoach.name;
  return { ok: true };
}

function marketTierIndex(name) {
  return MARKETS.findIndex((m) => m.name === name);
}
// The fee scales with how many tiers apart the old and new market are — any tier is
// reachable from any tier, a bigger jump just costs more, rather than forcing a team to step
// through every tier in between.
export function relocationCost(team, marketName) {
  const fromIdx = team.market ? marketTierIndex(team.market.name) : 0;
  const toIdx = marketTierIndex(marketName);
  const distance = Math.max(1, Math.abs(toIdx - fromIdx));
  return FINANCE_RELOCATION_BASE + FINANCE_RELOCATION_PER_TIER * distance;
}
export function relocateMarket(state, teamIdx, marketName) {
  const team = state.teams[teamIdx];
  const targetDef = MARKETS.find((m) => m.name === marketName);
  if (!targetDef) return { ok: false, msg: 'Unknown market.' };
  if (team.market && team.market.name === marketName) return { ok: false, msg: 'Already in that market.' };
  const cost = relocationCost(team, marketName);
  if ((team.finances || 0) < cost) return { ok: false, msg: `Not enough finances — relocating here costs ${cost}, you have ${team.finances || 0}.` };
  team.finances -= cost;
  team.market = { name: targetDef.name, capAdj: rollMarketCapAdj(targetDef) };
  finalizeCap(team, state.season);
  return { ok: true };
}

// Small, permanent, repeatable — capped to once per season so it can't be bought over and
// over in a single season into a runaway baseline.
export function investInFanbase(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.financeBoostUsedThisSeason) return { ok: false, msg: 'Already invested in your fanbase this season.' };
  if ((team.finances || 0) < FINANCE_FANBASE_BOOST_COST) return { ok: false, msg: `Not enough finances — this costs ${FINANCE_FANBASE_BOOST_COST}.` };
  team.finances -= FINANCE_FANBASE_BOOST_COST;
  team.fanbaseBaseline = (team.fanbaseBaseline || 0) + FINANCE_FANBASE_BOOST_AMOUNT;
  team.financeBoostUsedThisSeason = true;
  return { ok: true };
}
