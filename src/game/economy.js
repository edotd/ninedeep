export function baseCap(season) {
  return 20 + (season - 1) * 1;
}

export function formatCoins(n) {
  const rounded = Math.round(n * 2) / 2;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
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
  let cap = (base + (team.market ? team.market.capAdj : 0) + (team.draftTradeBonus || 0)) * attendanceMult - (team.lastOverage || 0);
  cap = Math.max(cap, Math.round(base * 0.7));
  cap = Math.round(cap * 2) / 2;
  team.seasonCap = cap;
  team.lastOverage = 0;
  team.draftTradeBonus = 0;
}

export function rosterSalary(team) {
  return team.hand.reduce((s, c) => s + c.salary, 0) + (team.coach ? team.coach.salary : 0);
}
