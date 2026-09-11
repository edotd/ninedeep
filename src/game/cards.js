import { ARCHETYPES, POSITIONS, POSITION_MOD, COACH_ARCHETYPES, COACH_MODIFIERS, MATCHUP_MODIFIER_TYPES, PLAYER_RELATIONSHIP_MIN, PLAYER_RELATIONSHIP_MAX } from './constants';
import { rollWithVariance, weightedPick } from './rng';
import { randomPlayerAge, randomCoachAge, careerMultiplier } from './aging';

// Card ids are generated from a counter stored on the shared game state (not a module-level
// variable) so they stay unique across reconnects/reloads once state lives in Firestore.
export function nextCardId(state) {
  state.cardCounter = (state.cardCounter || 0) + 1;
  return 'c' + state.cardCounter;
}

export function statsToCoins(total) {
  let v = Math.round(((total - 12) / 6) * 2) / 2;
  return Math.max(0, Math.min(5, v));
}

export function makeCard(state, archName, position, tier) {
  const arch = ARCHETYPES[archName];
  const peakKey = tier.forceStat || arch.peak;
  const stats = {};
  let total = 0;
  ['SCO', 'PLM', 'REB', 'DEF'].forEach((k) => {
    const base = arch.base[k] + POSITION_MOD[position][k];
    let v = base * tier.uniform;
    if (k === peakKey) v *= tier.peak;
    v = Math.round(v);
    v = rollWithVariance(v, 1);
    v = Math.max(1, v);
    stats[k] = v;
    total += v;
  });
  const contract = Math.max(1, rollWithVariance(tier.contract, 1));
  const contractDeviation = tier.contract - contract; // positive = shorter than typical for this tier
  let salary = statsToCoins(total) * (1 + contractDeviation * 0.15);
  salary = Math.max(0, Math.round(salary * 2) / 2);
  return {
    id: nextCardId(state),
    archetype: archName,
    position,
    tierName: tier.name,
    stats,
    salary,
    contract,
    maxContract: contract,
    age: randomPlayerAge(),
    careerRoll: Math.random(),
  };
}

export function randomArch() {
  const a = Object.keys(ARCHETYPES);
  return a[Math.floor(Math.random() * a.length)];
}
export function randomPos() {
  return POSITIONS[Math.floor(Math.random() * 3)];
}
// Current effective ability, not raw talent: scaled by the player's Career Level bonus,
// so a card's on-court output rises and falls across the era as they age.
export function cardTotal(c) {
  const raw = c.stats.SCO + c.stats.PLM + c.stats.REB + c.stats.DEF;
  return Math.round(raw * careerMultiplier(c.age, c.careerRoll));
}

export function neededPosition(team) {
  const counts = { Guard: 0, Forward: 0, Big: 0 };
  team.hand.forEach((c) => counts[c.position]++);
  const missing = POSITIONS.filter((p) => counts[p] === 0);
  return missing.length ? missing[Math.floor(Math.random() * missing.length)] : null;
}

export function drawCoachCard() {
  const archNames = Object.keys(COACH_ARCHETYPES);
  const archName = archNames[Math.floor(Math.random() * archNames.length)];
  const arch = COACH_ARCHETYPES[archName];
  const mod = weightedPick(COACH_MODIFIERS);
  const offRolled = rollWithVariance(arch.offBase, 1);
  const defRolled = rollWithVariance(arch.defBase, 1);
  const offBonus = Math.round(offRolled * mod.mult) / 100;
  const defBonus = Math.round(defRolled * mod.mult) / 100;
  let offDie, defDie;
  if (mod.hofDie) {
    const rolled = 6 + Math.floor(Math.random() * 4); // 6, 7, 8, or 9
    offDie = rolled;
    defDie = rolled;
  } else {
    offDie = mod.die;
    defDie = mod.die;
  }
  return {
    name: archName + ' ' + mod.name,
    archetype: archName,
    modifier: mod.name,
    ability: mod.ability,
    salary: mod.salary,
    offBonus,
    defBonus,
    offDie,
    defDie,
    age: randomCoachAge(),
    playerRelationship: rollPlayerRelationship(mod.name),
  };
}

// A coach who's a Former Player relates to the roster better than most — bias their
// baseline relationship roll up instead of drawing from the full 1-10 range.
function rollPlayerRelationship(modifierName) {
  const min = modifierName === 'Former Player' ? PLAYER_RELATIONSHIP_MIN + 3 : PLAYER_RELATIONSHIP_MIN;
  const roll = min + Math.floor(Math.random() * (PLAYER_RELATIONSHIP_MAX - min + 1));
  return Math.min(PLAYER_RELATIONSHIP_MAX, roll);
}

export function applyCoachRetention(team, coach) {
  team.retainedStreak = team.lastCoachName === coach.name ? (team.retainedStreak || 0) + 1 : 0;
  team.lastCoachName = coach.name;
}
export function retentionBonus(team) {
  return team.coach.modifier === 'Collegiate Success' ? 0.03 * (team.retainedStreak || 0) : 0;
}
export function retentionDieBump(team) {
  return team.coach.modifier === 'Collegiate Success' ? team.retainedStreak || 0 : 0;
}
// A coach who relates well to the roster gets a small Off/Def bonus, same shape as
// retentionBonus: +0.5% per Player Relationship point, up to +5% at the max of 10.
export function relationshipBonus(team) {
  return team.coach.playerRelationship ? team.coach.playerRelationship * 0.005 : 0;
}

export function drawMatchupModifierCard() {
  const t = weightedPick(MATCHUP_MODIFIER_TYPES);
  const value = t.needsValue ? 1 + Math.floor(Math.random() * (t.valueDie || 10)) : null;
  return { name: t.name, category: t.category, flavor: t.flavor, playable: !!t.playable, reactive: !!t.reactive, passive: t.passive || null, value, used: false };
}
