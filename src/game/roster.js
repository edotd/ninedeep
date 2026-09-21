import { applySynergy, teamSynergy } from './skillsets';
import { POSITIONS } from './constants';
import { cardTotal, retentionBonus, retentionDieBump, relationshipBonus } from './cards';
import { handsOffBonus } from './gm';
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
  const positions = new Set(team.activeIds.map((id) => team.hand.find((h) => h.id === id)?.position).filter(Boolean));
  if (!positions.has('Guard') || !positions.has('Forward') || !positions.has('Big'))
    return { valid: false, msg: 'Your active five needs at least one Guard, Forward, and Big.' };
  return { valid: true };
}

// team.activeIds can briefly point at cards no longer in team.hand — e.g. between the
// playoffs ending and the next season's lineup lock, once an expired contract has been
// removed from hand but activeIds hasn't been recomputed yet — so every lookup here has to
// tolerate a miss instead of assuming team.hand.find(...) always succeeds.
export function activeStatSum(team) {
  return team.activeIds.reduce((s, id) => { const c = team.hand.find((h) => h.id === id); return c ? s + cardTotal(c) : s; }, 0);
}
// Seeding needs to see the same Team Chemistry/Skillset synergy that Proj Offense/Defense
// (offenseModifier/defenseModifier, below) already apply — otherwise a roster built around
// chemistry can lead the league in projected output and still seed near the bottom, since the
// bonus that's actually carrying it never touched the seeding math. Folded in the same way
// the coach bonus already is: averaged across both sides into one blended multiplier, since
// this is one undifferentiated stat total rather than separate offense/defense sums.
export function effectiveRating(team) {
  const bonus = retentionBonus(team) + relationshipBonus(team) + handsOffBonus(team);
  const synergy = teamSynergy(team);
  const synergyAvg = (synergy.offense + synergy.defense) / 200;
  return activeStatSum(team) * (1 + (team.coach.offBonus + bonus + team.coach.defBonus + bonus) / 2 + synergyAvg);
}

// SCO/PLM (offense) and DEF/REB (defense) contributions are scaled per-card by that
// player's current Career Level bonus, same as cardTotal — a declining roster's actual
// dice modifiers shrink even though the printed card stats never change.
export function offenseStatSum(team, idsOverride) {
  const ids = idsOverride || team.activeIds;
  const sum = ids.reduce((s, id) => {
    const c = team.hand.find((h) => h.id === id);
    if (!c) return s;
    return s + (c.stats.SCO + c.stats.PLM) * careerMultiplier(c, c.careerRoll);
  }, 0);
  return Math.round(sum);
}
export function defenseStatSum(team, idsOverride) {
  const ids = idsOverride || team.activeIds;
  const sum = ids.reduce((s, id) => {
    const c = team.hand.find((h) => h.id === id);
    if (!c) return s;
    return s + (c.stats.DEF + c.stats.REB) * careerMultiplier(c, c.careerRoll);
  }, 0);
  return Math.round(sum);
}
// Same math as offenseModifier/defenseModifier, but itemized — for the roll breakdown popover,
// which needs each step (stat sum, coach bonus, roster chemistry, synergy) on its own rather
// than just the final number.
export function modifierBreakdown(team, idsOverride, kind) {
  const off = kind === 'offense';
  const statSum = off ? offenseStatSum(team, idsOverride) : defenseStatSum(team, idsOverride);
  const coachBonus = off ? team.coach.offBonus : team.coach.defBonus;
  const retention = retentionBonus(team);
  const relationship = relationshipBonus(team);
  const handsOff = handsOffBonus(team);
  const preSynergyBase = Math.round((statSum * (1 + coachBonus + retention + relationship + handsOff)) / 20);
  const synergyPct = teamSynergy(team, idsOverride)[kind];
  const base = applySynergy(preSynergyBase, team, idsOverride, kind);
  return { statSum, coachBonus, retention, relationship, handsOff, preSynergyBase, synergyPct, base };
}
export function offenseModifier(team, idsOverride) {
  return modifierBreakdown(team, idsOverride, 'offense').base;
}
export function defenseModifier(team, idsOverride) {
  return modifierBreakdown(team, idsOverride, 'defense').base;
}
export function offenseDieSize(team) { return team.coach.offDie + retentionDieBump(team); }
export function defenseDieSize(team) { return team.coach.defDie + retentionDieBump(team); }
