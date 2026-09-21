import { MIN_GM_COST } from './constants';

export function baseCap() {
  return 20;
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

export function finalizeCap(team) {
  const base = baseCap();
  const attendanceMult = 0.9 + (team.attendance !== undefined ? team.attendance : 0.5) * 0.2;
  let cap = (base + (team.market ? team.market.capAdj : 0) + (team.draftTradeBonus || 0)) * attendanceMult - (team.lastOverage || 0);
  cap = Math.max(cap, Math.round(base * 0.7));
  cap = Math.round(cap * 2) / 2;
  team.seasonCap = cap;
  team.lastOverage = 0;
  team.draftTradeBonus = 0;
  // Dead cap (see finances.js/deadCapDue below) shrinks by one season every time the roster
  // turns over into a new season — a charge scheduled for `seasonsLeft` seasons (including
  // the one it was created in) falls off once every one of those seasons has been charged.
  team.deadCap = (team.deadCap || [])
    .map((c) => ({ amount: c.amount, seasonsLeft: c.seasonsLeft - 1 }))
    .filter((c) => c.seasonsLeft > 0);
}

// Every GM costs at least MIN_GM_COST — a Neutral GM used to be free, but firing one now
// leaves dead cap behind (see finances.js), and a free GM would make that charge meaningless.
export function gmCost(gmType) {
  return gmType === 'Aggressive' || gmType === 'Hands-Off' ? 1 : MIN_GM_COST;
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
