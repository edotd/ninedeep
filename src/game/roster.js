import { POSITIONS } from './constants';
import { cardTotal, retentionBonus, retentionDieBump, relationshipBonus } from './cards';
import { careerMultiplier } from './aging';

export function autoSelectFive(hand) {
  const byPos = { Guard: [], Forward: [], Big: [] };
  hand.forEach((c) => byPos[c.position].push(c));
  POSITIONS.forEach((p) => byPos[p].sort((a, b) => cardTotal(b) - cardTotal(a)));
  let chosen = [];
  POSITIONS.forEach((p) => { if (byPos[p][0]) chosen.push(byPos[p][0]); });
  let remaining = hand.filter((c) => !chosen.includes(c)).sort((a, b) => cardTotal(b) - cardTotal(a));
  for (const c of remaining) {
    if (chosen.length >= 5) break;
    chosen.push(c);
  }
  return chosen.slice(0, 5).map((c) => c.id);
}

export function validateLineup(team) {
  if (team.activeIds.length !== 5) return { valid: false, msg: 'Select exactly 5 players for your active roster.' };
  const positions = new Set(team.activeIds.map((id) => team.hand.find((h) => h.id === id).position));
  if (!positions.has('Guard') || !positions.has('Forward') || !positions.has('Big'))
    return { valid: false, msg: 'Your active five needs at least one Guard, Forward, and Big.' };
  return { valid: true };
}

export function activeStatSum(team) {
  return team.activeIds.reduce((s, id) => { const c = team.hand.find((h) => h.id === id); return s + cardTotal(c); }, 0);
}
export function effectiveRating(team) {
  const bonus = retentionBonus(team) + relationshipBonus(team);
  return activeStatSum(team) * (1 + (team.coach.offBonus + bonus + team.coach.defBonus + bonus) / 2);
}

// SCO/PLM (offense) and DEF/REB (defense) contributions are scaled per-card by that
// player's current Career Level bonus, same as cardTotal — a declining roster's actual
// dice modifiers shrink even though the printed card stats never change.
export function offenseStatSum(team, idsOverride) {
  const ids = idsOverride || team.activeIds;
  const sum = ids.reduce((s, id) => {
    const c = team.hand.find((h) => h.id === id);
    return s + (c.stats.SCO + c.stats.PLM) * careerMultiplier(c.age, c.careerRoll);
  }, 0);
  return Math.round(sum);
}
export function defenseStatSum(team, idsOverride) {
  const ids = idsOverride || team.activeIds;
  const sum = ids.reduce((s, id) => {
    const c = team.hand.find((h) => h.id === id);
    return s + (c.stats.DEF + c.stats.REB) * careerMultiplier(c.age, c.careerRoll);
  }, 0);
  return Math.round(sum);
}
export function offenseModifier(team, idsOverride) {
  return Math.round((offenseStatSum(team, idsOverride) * (1 + team.coach.offBonus + retentionBonus(team) + relationshipBonus(team))) / 20);
}
export function defenseModifier(team, idsOverride) {
  return Math.round((defenseStatSum(team, idsOverride) * (1 + team.coach.defBonus + retentionBonus(team) + relationshipBonus(team))) / 20);
}
export function offenseDieSize(team) { return team.coach.offDie + retentionDieBump(team); }
export function defenseDieSize(team) { return team.coach.defDie + retentionDieBump(team); }
