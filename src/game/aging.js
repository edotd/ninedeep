import {
  PLAYER_AGE_MIN, PLAYER_AGE_MAX, PLAYER_PRIME_START, PLAYER_PRIME_BASE_END,
  COACH_AGE_MIN, COACH_AGE_MAX,
} from './constants';

export function randomPlayerAge() {
  return PLAYER_AGE_MIN + Math.floor(Math.random() * (PLAYER_AGE_MAX - PLAYER_AGE_MIN + 1));
}
export function randomCoachAge() {
  return COACH_AGE_MIN + Math.floor(Math.random() * (COACH_AGE_MAX - COACH_AGE_MIN + 1));
}
// League Accolade tiers (other than Generational Talent) only roll on players whose age
// falls within the Prime window — you don't win these before or after your prime.
export function randomPrimeAge() {
  return PLAYER_PRIME_START + Math.floor(Math.random() * (PLAYER_PRIME_BASE_END - PLAYER_PRIME_START + 1));
}

// Career Level: a player's age bucket, each with its own output bonus range. A player's
// exact spot within their bucket's range is fixed for their career (see careerRoll below,
// rolled once at creation) — this is what used to be a separate "Extended Prime" stat;
// it now shows up only as part of the Career Level bonus itself, not its own number.
export const CAREER_LEVELS = {
  Young: { min: 0.10, max: 0.40 },
  Prime: { min: 0.50, max: 1.00 },
  Declining: { min: -0.65, max: -0.10 },
};

export function careerLevel(age) {
  if (age < PLAYER_PRIME_START) return 'Young';
  if (age <= PLAYER_PRIME_BASE_END) return 'Prime';
  return 'Declining';
}

function lerp(a, b, t) { return a + (b - a) * t; }

// careerRoll is a fixed 0-1 "quality" trait rolled once per card — higher always means a
// better outcome for that bucket (least decline when Declining, most bonus when Young/Prime).
export function careerBonus(age, careerRoll) {
  const { min, max } = CAREER_LEVELS[careerLevel(age)];
  return lerp(min, max, careerRoll);
}

export function careerMultiplier(age, careerRoll) {
  return 1 + careerBonus(age, careerRoll);
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
