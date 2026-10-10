import { POSITION_GAMEPLAN_TYPES } from './supplementalCards';
import { POSITIONS, SECONDARY_GAMEPLAN_FACTOR, GAMEMASTER_BOOST_BY_RARITY } from './constants';

export const COACH_GAMEPLANS = [
  { name: 'Run And Gun', description: '+8% team Offense.', effects: { offPercent: 8 } },
  { name: 'Pack The Paint', description: '+8% team Defense.', effects: { defPercent: 8 } },
  { name: 'Second Unit Focus', description: '+3 Bench Output.', effects: { benchBonus: 3 } },
  { name: 'Numbers Advantage', description: '+12% team Offense if 3 or more starters share a position.', dynamicEffect: { type: 'positionThreshold', minCount: 3, bonusPercent: 12, ability: 'offense' } },
  { name: 'United Front', description: '+12% team Defense if 3 or more starters share a position.', dynamicEffect: { type: 'positionThreshold', minCount: 3, bonusPercent: 12, ability: 'defense' } },
  ...POSITION_GAMEPLAN_TYPES.map(({ name, description, dynamicEffect }) => ({ name, description, dynamicEffect })),
];

export const DEVELOPMENT_STATS_BY_STYLE = {
  'Offensive Minded': ['SCO', 'PLM'],
  'Defensive Minded': ['REB', 'DEF'],
  Balanced: ['SCO', 'PLM', 'REB', 'DEF'],
};

function resolveDynamicEffects(team, dynamicEffect) {
  const activeIds = new Set(team.activeIds || []);
  const starters = (team.hand || []).filter((player) => activeIds.has(player.id));
  const key = dynamicEffect.ability === 'offense' ? 'offPercent' : 'defPercent';
  if (dynamicEffect.type === 'positionCount') {
    const count = starters.filter((player) => player.position === dynamicEffect.position).length;
    return { [key]: dynamicEffect.perCount * count };
  }
  if (dynamicEffect.type === 'positionThreshold') {
    const maxCount = Math.max(0, ...POSITIONS.map((position) => starters.filter((player) => player.position === position).length));
    return { [key]: maxCount >= dynamicEffect.minCount ? dynamicEffect.bonusPercent : 0 };
  }
  return { [key]: 0 };
}

function drawUnique(definitions, count) {
  const pool = definitions.slice();
  const picks = [];
  while (picks.length < count && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return picks;
}

function planWithId(plan, index) {
  return { ...plan, id: `coach-plan-${index}-${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` };
}

export function ensureCoachSystems(team) {
  if (!team?.coach) return;
  if (!Array.isArray(team.coach.gameplans) || team.coach.gameplans.length < 2) {
    const seed = String(team.coach.name || team.coach.archetype || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const first = seed % COACH_GAMEPLANS.length;
    const second = (first + 1 + (seed % (COACH_GAMEPLANS.length - 1))) % COACH_GAMEPLANS.length;
    team.coach.gameplans = [planWithId(COACH_GAMEPLANS[first], 0), planWithId(COACH_GAMEPLANS[second], 1)];
  }
  if (team.activeGameplanId === undefined) team.activeGameplanId = null;
  team.developmentPoints = Number.isFinite(team.developmentPoints) ? team.developmentPoints : 2;
  team.developmentCards = [];
  team.gameplanCards = [];
}

export function activeCoachGameplan(team) {
  ensureCoachSystems(team);
  if (!team?.activeGameplanId) return null;
  return team.coach?.gameplans?.find((plan) => plan.id === team.activeGameplanId) || null;
}

// Secondary Gameplan (second in the coach's list) is halved unless the coach is Fully Prepared;
// Gamemaster then boosts whichever plan is chosen by a rarity-based 4–10%.
function scaleGameplanEffects(team, plan, effects) {
  const modifier = team?.coach?.modifier;
  let factor = 1;
  const isSecondary = (team?.coach?.gameplans || []).findIndex((candidate) => candidate.id === plan.id) === 1;
  if (isSecondary && modifier !== 'Fully Prepared') factor *= SECONDARY_GAMEPLAN_FACTOR;
  if (modifier === 'Gamemaster') factor *= 1 + (GAMEMASTER_BOOST_BY_RARITY[team.coach.rarity] ?? GAMEMASTER_BOOST_BY_RARITY.Core);
  if (factor === 1) return effects;
  return Object.fromEntries(Object.entries(effects).map(([key, value]) => [key, typeof value === 'number' ? value * factor : value]));
}

export function gameplanEffects(team, plan = activeCoachGameplan(team)) {
  if (!plan) return {};
  const base = plan.dynamicEffect ? resolveDynamicEffects(team, plan.dynamicEffect) : { ...(plan.effects || {}) };
  return scaleGameplanEffects(team, plan, base);
}

export function syncSeasonGameplan(team) {
  const effects = gameplanEffects(team);
  team.seasonGameplanEffects = {
    offPercent: effects.offPercent || 0,
    defPercent: effects.defPercent || 0,
    benchBonus: effects.benchBonus || 0,
    seedingPercent: effects.seedingPercent || 0,
  };
}

export function dealStrategyCards(_state, team) {
  if (!team?.coach) return;
  team.coach.gameplans = drawUnique(COACH_GAMEPLANS, 2).map(planWithId);
  team.activeGameplanId = null;
  team.developmentPoints = 2;
  team.developmentCards = [];
  team.gameplanCards = [];
  syncSeasonGameplan(team);
}

export function setCoachGameplan(state, teamIdx, planId) {
  const team = state.teams[teamIdx];
  ensureCoachSystems(team);
  if (!team?.coach?.gameplans?.some((plan) => plan.id === planId)) return { ok: false, msg: 'That Gameplan is not available to this coach.' };
  if (team.lineupConfirmed) return { ok: false, msg: 'The lineup and Gameplan are already locked for this season.' };
  team.activeGameplanId = planId;
  syncSeasonGameplan(team);
  return { ok: true };
}

export function applyDevelopmentPoint(state, teamIdx, playerId, stat) {
  const team = state.teams[teamIdx];
  ensureCoachSystems(team);
  const player = team?.hand?.find((candidate) => String(candidate.id) === String(playerId));
  if (!player) return { ok: false, msg: 'Choose a player on your roster.' };
  if ((team.developmentPoints || 0) <= 0) return { ok: false, msg: 'This coach has no Development Points remaining this season.' };
  const eligible = DEVELOPMENT_STATS_BY_STYLE[team.coach.archetype] || DEVELOPMENT_STATS_BY_STYLE.Balanced;
  if (!eligible.includes(stat)) return { ok: false, msg: `${team.coach.archetype} coaches can develop ${eligible.join(' or ')}.` };
  player.stats[stat] = (player.stats[stat] || 0) + 1;
  player.development ||= { cardName: 'Coach Development', description: 'Permanent coach development.', statChanges: {}, seasons: [] };
  player.development.statChanges[stat] = (player.development.statChanges[stat] || 0) + 1;
  player.development.seasons ||= [];
  player.development.seasons.push(state.season);
  team.developmentPoints -= 1;
  return { ok: true };
}

export function applyDevelopmentCard(state, teamIdx, _cardId, playerId, stat = 'SCO') {
  return applyDevelopmentPoint(state, teamIdx, playerId, stat);
}

function addEffects(target, effects) {
  target.offPercent = (target.offPercent || 0) + (effects.offPercent || 0);
  target.defPercent = (target.defPercent || 0) + (effects.defPercent || 0);
  target.benchBonus = (target.benchBonus || 0) + (effects.benchBonus || 0);
  target.seedingPercent = (target.seedingPercent || 0) + (effects.seedingPercent || 0);
}

export function applyGameplanToTurn(turn, side, plan, team) {
  if (!plan) return;
  const own = side === 'a' ? turn.extraA : turn.extraB;
  addEffects(own, gameplanEffects(team, plan));
  turn.gameplanNotes ||= [];
  turn.gameplanNotes.push({ teamSide: side, cardName: plan.name, description: plan.description, card: { ...plan } });
}

export function playGameplanCard(state, teamIdx, planId) {
  return setCoachGameplan(state, teamIdx, planId);
}

export function autoPlaySeasonGameplans(_state, team) {
  ensureCoachSystems(team);
  syncSeasonGameplan(team);
}
