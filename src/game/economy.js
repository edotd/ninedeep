export function baseCap(season) {
  return 20 + (season - 1) * 1;
}

export function formatCoins(n) {
  const rounded = Math.round(n * 2) / 2;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return '🪙' + text;
}

export function finalizeCap(team, season) {
  const base = baseCap(season);
  const attendanceMult = 0.9 + (team.attendance !== undefined ? team.attendance : 0.5) * 0.2;
  let cap = (base + (team.market ? team.market.capAdj : 0)) * attendanceMult - (team.lastOverage || 0);
  cap = Math.max(cap, Math.round(base * 0.7));
  cap = Math.round(cap * 2) / 2;
  team.seasonCap = cap;
  team.lastOverage = 0;
}

export function rosterSalary(team) {
  return team.hand.reduce((s, c) => s + c.salary, 0) + (team.coach ? team.coach.salary : 0);
}
