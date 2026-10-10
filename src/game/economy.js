import { MIN_GM_COST, MAX_CAP_OVERAGE, BUDGET_SCALE, SHADY_DEALER_STEP } from './constants';

// The cap every franchise starts from — budgets are on a 100-point scale.
export function baseCap() {
  return 100;
}

// What a Cap Architect GM adds to the cap: its rolled strength (1-4) in budget points.
export function capArchitectBonus(trait) {
  return trait?.name === 'Cap Architect' ? (trait.value || 0) * BUDGET_SCALE : 0;
}

export function formatCoins(n) {
  const cents = Math.round(n * 100);
  const text = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(cents % 10 === 0 ? 1 : 2);
  return '🪙' + text;
}

export function finalizeCap(team) {
  const base = baseCap();
  const gmBudget = capArchitectBonus(team.gmTrait);
  let cap = base + gmBudget + (team.draftTradeBonus || 0) - (team.lastOverage || 0);
  cap = Math.max(cap, Math.round(base * 0.7));
  cap = Math.round(cap);
  team.seasonCap = cap;
  team.lastOverage = 0;
  team.draftTradeBonus = 0;
  // Dead cap (see finances.js/deadCapDue below) shrinks by one season every time the roster
  // turns over into a new season — a charge scheduled for `seasonsLeft` seasons (including
  // the one it was created in) falls off once every one of those seasons has been charged.
  team.deadCap = (team.deadCap || [])
    .map((c) => ({ ...c, seasonsLeft: c.seasonsLeft - 1 }))
    .filter((c) => c.seasonsLeft > 0);
}

// Every GM costs at least MIN_GM_COST — a Neutral GM used to be free, but firing one now
// leaves dead cap behind (see finances.js), and a free GM would make that charge meaningless.
export function gmCost(gmType) {
  return gmType ? MIN_GM_COST : 0;
}

// Dead cap owed this season — half the salary of a player cut (or coach/GM fired) with time
// left on their deal, charged every season from the cut through however many they had left.
// See finances.js for how entries get created and the salary-cap spec this implements.
export function deadCapDue(team) {
  return (team.deadCap || []).reduce((s, c) => s + c.amount, 0);
}

export function rosterSalary(team) {
  const total = team.hand.reduce((s, c) => s + c.salary, 0) + (team.coach ? team.coach.salary : 0) + (team.gmType ? gmCost(team.gmType) : 0) + deadCapDue(team);
  return Math.round(total * 100) / 100;
}

// Unused season cap room right now — negotiation.js and bidding.js both validate new offers
// against this rather than re-deriving seasonCap - rosterSalary(team) inline at each call site.
export function remainingCap(team) {
  return Math.round(((team.seasonCap || 0) - rosterSalary(team)) * 100) / 100;
}

// How far over its cap a team may sit: up to MAX_CAP_OVERAGE, but not two seasons running —
// team.overBudgetLastSeason is set when a season locks (season.js's lockSeasonAndSeed).
export function overageAllowance(team) {
  return team.overBudgetLastSeason ? 0 : maxOverage(team);
}

// How far over its cap a team may lock in at all: MAX_CAP_OVERAGE, plus what a Shady Dealer GM
// adds (SHADY_DEALER_STEP per point of its rolled strength).
export function shadyDealerBonus(trait) {
  return trait?.name === 'Shady Dealer' ? (trait.value || 0) * SHADY_DEALER_STEP : 0;
}
export function maxOverage(team) {
  return MAX_CAP_OVERAGE + shadyDealerBonus(team.gmTrait);
}

// What a human team can actually still commit to a signing or bid: its cap room plus the
// overage it is allowed to carry into the season (see confirmLineup, engine.js).
export function isOverLimit(team) {
  return rosterSalary(team) > (team.seasonCap || 0) + overageAllowance(team) + 1e-9;
}

export function spendableRoom(team) {
  return Math.round((remainingCap(team) + overageAllowance(team)) * 100) / 100;
}
