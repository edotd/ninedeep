import {
  PLAYER_AGE_MIN, PLAYER_AGE_MAX, PLAYER_PRIME_START, PLAYER_PEAK_START, PLAYER_PEAK_END,
  PLAYER_PRIME_BASE_END, COACH_AGE_MIN, COACH_AGE_MAX, EXTENDED_PRIME_MIN, EXTENDED_PRIME_MAX,
} from './constants';

export function randomPlayerAge() {
  return PLAYER_AGE_MIN + Math.floor(Math.random() * (PLAYER_AGE_MAX - PLAYER_AGE_MIN + 1));
}
export function randomCoachAge() {
  return COACH_AGE_MIN + Math.floor(Math.random() * (COACH_AGE_MAX - COACH_AGE_MIN + 1));
}
export function randomExtendedPrime() {
  return EXTENDED_PRIME_MIN + Math.floor(Math.random() * (EXTENDED_PRIME_MAX - EXTENDED_PRIME_MIN + 1));
}

// Extended Prime (1-10) pushes back the age where prime tapers into decline — at the
// minimum value prime ends at PLAYER_PRIME_BASE_END (35); at the maximum it holds all
// the way to PLAYER_AGE_MAX (40).
function primeEnd(extendedPrime) {
  const span = PLAYER_AGE_MAX - PLAYER_PRIME_BASE_END;
  const t = (extendedPrime - EXTENDED_PRIME_MIN) / (EXTENDED_PRIME_MAX - EXTENDED_PRIME_MIN);
  return PLAYER_PRIME_BASE_END + Math.round(t * span);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Performance multiplier applied to a player's stats based on age: ramps up approaching
// prime, peaks at 30-32, then tapers — with Extended Prime stretching how long the taper
// takes to arrive. Exact curve shape (0.80 at 20, 1.15 at peak, 0.70 at 40) is a design
// choice, not something the original prototype specified.
const YOUNG_MULT = 0.80;
const PRIME_EDGE_MULT = 1.00;
const PEAK_MULT = 1.15;
const OLD_MULT = 0.70;

export function ageMultiplier(age, extendedPrime) {
  const a = Math.max(PLAYER_AGE_MIN, Math.min(PLAYER_AGE_MAX, age));
  const end = primeEnd(extendedPrime);
  if (a <= PLAYER_PRIME_START) {
    const t = (a - PLAYER_AGE_MIN) / (PLAYER_PRIME_START - PLAYER_AGE_MIN);
    return lerp(YOUNG_MULT, PRIME_EDGE_MULT, t);
  }
  if (a <= PLAYER_PEAK_START) {
    const t = (a - PLAYER_PRIME_START) / (PLAYER_PEAK_START - PLAYER_PRIME_START);
    return lerp(PRIME_EDGE_MULT, PEAK_MULT, t);
  }
  if (a <= PLAYER_PEAK_END) return PEAK_MULT;
  if (a <= end) {
    const t = (a - PLAYER_PEAK_END) / Math.max(1, end - PLAYER_PEAK_END);
    return lerp(PEAK_MULT, PRIME_EDGE_MULT, t);
  }
  const t = (a - end) / Math.max(1, PLAYER_AGE_MAX - end);
  return lerp(PRIME_EDGE_MULT, OLD_MULT, t);
}

// Display label for a player's current age phase.
export function agePhase(age, extendedPrime) {
  const end = primeEnd(extendedPrime);
  if (age < PLAYER_PRIME_START) return 'Rising';
  if (age >= PLAYER_PEAK_START && age <= PLAYER_PEAK_END) return 'Peak';
  if (age <= end) return 'Prime';
  return 'Declining';
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Team Experience (1-10): a scouting-style rating blending roster/coach age (veteran teams
// read as more experienced) with title and playoff-appearance history. Weights (40% age,
// 30% titles, 30% playoff appearances) and the normalization caps (3 titles, 5 appearances
// treated as "maxed out") are a judgment call — the brief only specified the inputs.
export function teamExperience(team) {
  if (!team.hand || !team.hand.length || !team.coach) return null;
  const avgPlayerAge = team.hand.reduce((s, c) => s + c.age, 0) / team.hand.length;
  const playerAgeNorm = clamp01((avgPlayerAge - PLAYER_AGE_MIN) / (PLAYER_AGE_MAX - PLAYER_AGE_MIN));
  const coachAgeNorm = clamp01((team.coach.age - COACH_AGE_MIN) / (COACH_AGE_MAX - COACH_AGE_MIN));
  const ageComponent = (playerAgeNorm + coachAgeNorm) / 2;
  const titlesComponent = clamp01((team.titles || 0) / 3);
  const playoffComponent = clamp01((team.playoffAppearances || 0) / 5);
  const raw = ageComponent * 0.4 + titlesComponent * 0.3 + playoffComponent * 0.3;
  return Math.max(1, Math.min(10, 1 + Math.round(raw * 9)));
}
