// Career stages replace exact ages. Legacy saves with numeric ages are interpreted here
// and converted to a stage when the next season closes.
export const CAREER_STAGES = ['Young', 'Established', 'Prime', 'Veteran', 'Declining'];
export const CAREER_LEVELS = {
  Young: { min: 0.10, max: 0.30 },
  Established: { min: 0.25, max: 0.50 },
  Prime: { min: 0.50, max: 1.00 },
  Veteran: { min: 0.10, max: 0.35 },
  Declining: { min: -0.65, max: -0.10 },
};
const STAGE_SEASONS = { Young: 2, Established: 2, Prime: 3, Veteran: 2 };

export function randomCareerStage() {
  const roll = Math.random();
  return roll < 0.22 ? 'Young' : roll < 0.50 ? 'Established' : roll < 0.80 ? 'Prime' : roll < 0.95 ? 'Veteran' : 'Declining';
}

export function careerLevel(card) {
  if (typeof card === 'string' && CAREER_LEVELS[card]) return card;
  if (card?.careerStage && CAREER_LEVELS[card.careerStage]) return card.careerStage;
  const age = typeof card === 'number' ? card : card?.age;
  if (typeof age !== 'number') return 'Prime';
  if (age < 24) return 'Young';
  if (age < 28) return 'Established';
  if (age < 33) return 'Prime';
  if (age < 37) return 'Veteran';
  return 'Declining';
}

export function advanceCareer(card) {
  const stage = careerLevel(card);
  const years = (card.stageYears || 0) + 1;
  card.careerStage = years >= (STAGE_SEASONS[stage] || Infinity)
    ? CAREER_STAGES[Math.min(CAREER_STAGES.length - 1, CAREER_STAGES.indexOf(stage) + 1)]
    : stage;
  card.stageYears = card.careerStage === stage ? years : 0;
  delete card.age;
}

export function careerBonus(card, careerRoll) {
  const { min, max } = CAREER_LEVELS[careerLevel(card)];
  const roll = typeof careerRoll === 'number' ? careerRoll : 0.5;
  return min + (max - min) * roll;
}
export function careerMultiplier(card, careerRoll) { return 1 + careerBonus(card, careerRoll); }

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export function teamExperience(team) {
  if (!team.hand?.length || !team.coach) return null;
  const stageScore = team.hand.reduce((sum, card) => sum + CAREER_STAGES.indexOf(careerLevel(card)) / 4, 0) / team.hand.length;
  const coachTenure = clamp01((team.retainedStreak || 0) / 5);
  const titles = clamp01((team.titles || 0) / 3);
  const playoffs = clamp01((team.playoffAppearances || 0) / 5);
  return Math.max(1, Math.min(10, 1 + Math.round(((stageScore + coachTenure) * 0.2 + titles * 0.3 + playoffs * 0.3) * 9)));
}
