import { rollSkillset } from './skillsets';
import { ARCHETYPES, POSITIONS, POSITION_MOD, COACH_ARCHETYPES, COACH_MODIFIERS, MATCHUP_MODIFIER_TYPES, PLAYER_RELATIONSHIP_MIN, PLAYER_RELATIONSHIP_MAX, LEAGUE_ACCOLADES } from './constants';
import { rollWithVariance, weightedPick, shuffle } from './rng';
import { randomCareerStage, careerMultiplier } from './aging';

// Card ids are generated from a counter stored on the shared game state (not a module-level
// variable) so they stay unique across reconnects/reloads once state lives in Firestore.
export function nextCardId(state) {
  state.cardCounter = (state.cardCounter || 0) + 1;
  return 'c' + state.cardCounter;
}

const ACCOLADE_NAMES = new Set(LEAGUE_ACCOLADES.map((t) => t.name));

// Card tier per the brand handoff: A (franchise) = League Accolade tiers, D (depth) =
// Undrafted replacements, EXP (expiring) overrides everything in a player's final contract
// year, everything else is B (standard). Shared by PlayerCard and the persistent bar's
// player slots so a card's tier reads the same everywhere it appears.
export function cardTier(card) {
  if (card.contract <= 1) return 'EXP';
  if (ACCOLADE_NAMES.has(card.tierName)) return 'A';
  if (card.tierName === 'Undrafted') return 'D';
  return 'B';
}

// The big number on a player card / slot — the unmodified sum of its four stats, before
// career-level age adjustment (see cardTotal below for the age-adjusted version used in
// actual matchups).
export function rawOverall(card) {
  return card.stats.SCO + card.stats.PLM + card.stats.REB + card.stats.DEF;
}

export function statsToCoins(total) {
  let v = Math.round(((total - 12) / 6) * 2) / 2;
  return Math.max(0, Math.min(5, v));
}

export function makeCard(state, archName, position, tier) {
  const arch = ARCHETYPES[archName];
  const peakKeys = tier.forceStats || (tier.forceStat ? [tier.forceStat] : [arch.peak]);
  const stats = {};
  let total = 0;
  ['SCO', 'PLM', 'REB', 'DEF'].forEach((k) => {
    const base = arch.base[k] + POSITION_MOD[position][k];
    let v = base * tier.uniform;
    if (peakKeys.includes(k)) v *= tier.peak;
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
  // League Accolade tiers only roll on players in their prime, except Generational Talent.
  const careerStage = tier.accolade && !tier.primeExempt ? 'Prime' : randomCareerStage();
  return {
    id: nextCardId(state),
    archetype: archName,
    position,
    skillsetId: rollSkillset(position, archName),
    tierName: tier.name,
    stats,
    salary,
    contract,
    maxContract: contract,
    careerStage,
    stageYears: 0,
    careerRoll: Math.random(),
  };
}

export function randomArch() {
  const a = Object.keys(ARCHETYPES);
  return a[Math.floor(Math.random() * a.length)];
}

// Archetypes whose peak stat is the given one — 'Balanced' peaks SCO on paper but its base
// stats are flat across the board, so it's a plausible fit for any stat and is included
// everywhere rather than just under SCO.
const STAT_ARCHETYPES = {
  SCO: ['Scorer', 'Marksman', 'Balanced'],
  PLM: ['Pass-First', 'Playmaker', 'Balanced'],
  REB: ['Rebounder', 'Balanced'],
  DEF: ['Defender', 'Balanced'],
};

// A tier's forceStat/forceStats (Scoring Champion, Rebounding Champion, All-League Defensive
// Team, the High IQ/Hustler base tiers, etc.) names the stat the card is built around — so the
// archetype drawn for it should actually be good at that stat too, instead of randomArch()
// occasionally handing a Scoring Champion card to a Pass-First archetype. Tiers with no forced
// stat (All-League 1st/2nd Team, MVP Candidate, Generational Talent, Role Player, ...) stay
// fully random — those honors plausibly go to any kind of player.
export function randomArchForTier(tier) {
  const stats = tier.forceStats || (tier.forceStat ? [tier.forceStat] : null);
  if (!stats) return randomArch();
  const pool = [...new Set(stats.flatMap((s) => STAT_ARCHETYPES[s] || []))];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : randomArch();
}
export function randomPos() {
  return POSITIONS[Math.floor(Math.random() * 3)];
}
// Current effective ability, not raw talent: scaled by the player's Career Level bonus,
// so a card's on-court output rises and falls across the era as they age.
export function cardTotal(c) {
  const raw = c.stats.SCO + c.stats.PLM + c.stats.REB + c.stats.DEF;
  return Math.round(raw * careerMultiplier(c, c.careerRoll));
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

export function resetMatchupDeck(state) {
  state.matchupDeck = MATCHUP_MODIFIER_TYPES.map((c) => c.definitionId);
  shuffle(state.matchupDeck);
}

export function drawMatchupModifierCard(state, playableOnly = false) {
  if (!state.matchupDeck) resetMatchupDeck(state);
  const index = playableOnly ? state.matchupDeck.findLastIndex((id) => MATCHUP_MODIFIER_TYPES.find((c) => c.definitionId === id)?.playable) : state.matchupDeck.length - 1;
  if (index < 0) return null;
  const [definitionId] = state.matchupDeck.splice(index, 1);
  if (!definitionId) return null;
  const definition = MATCHUP_MODIFIER_TYPES.find((c) => c.definitionId === definitionId);
  return { ...definition, id: nextCardId(state), used: false };
}
