import { MIN_GM_COST } from './constants';

export function baseCap(season) {
  return 20 + (season - 1) * 1;
}

export function formatCoins(n) {
  const cents = Math.round(n * 100);
  const text = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(cents % 10 === 0 ? 1 : 2);
  return '🪙' + text;
}

// Market size only ever helps the cap — roll a concrete boost within the market's range
// once, at pull time, so it stays fixed for the rest of the era.
export function rollMarketCapAdj(market) {
  const v = market.capAdjMin + Math.random() * (market.capAdjMax - market.capAdjMin);
  return Math.round(v * 2) / 2;
}

export function finalizeCap(team, season) {
  const base = baseCap(season);
  const attendanceMult = 0.9 + (team.attendance !== undefined ? team.attendance : 0.5) * 0.2;
  const credits = team.pendingCapCredits || [];
  const creditTotal = credits.reduce((s, c) => s + c.amount, 0);
  let cap = (base + (team.market ? team.market.capAdj : 0) + (team.draftTradeBonus || 0) + creditTotal) * attendanceMult - (team.lastOverage || 0);
  cap = Math.max(cap, Math.round(base * 0.7));
  cap = Math.round(cap * 2) / 2;
  team.seasonCap = cap;
  team.lastOverage = 0;
  team.draftTradeBonus = 0;
  // Each credit (half the salary of a released player, or a fired coach/GM) applies for
  // exactly as many seasons as it was granted for, then falls off — see finances.js.
  team.pendingCapCredits = credits
    .map((c) => ({ amount: c.amount, yearsLeft: c.yearsLeft - 1 }))
    .filter((c) => c.yearsLeft > 0);
}

// Every GM costs at least MIN_GM_COST — a Neutral GM used to be free, but a GM firing now
// credits half its cost back to the budget (see finances.js), and a free GM would make that
// credit worthless.
export function gmCost(gmType) {
  return gmType === 'Aggressive' || gmType === 'Hands-Off' ? 1 : MIN_GM_COST;
}

export function rosterSalary(team) {
  const total = team.hand.reduce((s, c) => s + c.salary, 0) + (team.coach ? team.coach.salary : 0) + (team.gmType ? gmCost(team.gmType) : 0);
  return Math.round(total * 100) / 100;
}
