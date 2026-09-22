import { SEEDING_GAMEPLAN_TYPES } from './supplementalCards';

const DEVELOPMENT_DEFINITIONS = [
  { name: 'Shooting Lab', description: '+2 SCO permanently.', statChanges: { SCO: 2 } },
  { name: 'Lead Guard Reps', description: '+2 PLM permanently.', statChanges: { PLM: 2 } },
  { name: 'Glass Work', description: '+2 REB permanently.', statChanges: { REB: 2 } },
  { name: 'Defensive Camp', description: '+2 DEF permanently.', statChanges: { DEF: 2 } },
  { name: 'Complete Program', description: '+1 to every player stat permanently.', statChanges: { SCO: 1, PLM: 1, REB: 1, DEF: 1 } },
];

const GAMEPLAN_DEFINITIONS = [
  { name: 'Run And Gun', description: '+8% team Offense.', target: 'self', contexts: ['season', 'playoff'], effects: { offPercent: 8 } },
  { name: 'Pack The Paint', description: '+8% team Defense.', target: 'self', contexts: ['season', 'playoff'], effects: { defPercent: 8 } },
  { name: 'Second Unit Focus', description: '+3 Bench Output.', target: 'self', contexts: ['season', 'playoff'], effects: { benchBonus: 3 } },
  { name: 'Disrupt Rhythm', description: '-6% opponent Offense.', target: 'opponent', contexts: ['season', 'playoff'], effects: { offPercent: -6 } },
  { name: 'Attack Their Scheme', description: '-6% opponent Defense.', target: 'opponent', contexts: ['season', 'playoff'], effects: { defPercent: -6 } },
  ...SEEDING_GAMEPLAN_TYPES,
];

function nextId(state, prefix) {
  state.strategyCardCounter = (state.strategyCardCounter || 0) + 1;
  return `${prefix}${state.strategyCardCounter}`;
}

function draw(definitions) {
  return definitions[Math.floor(Math.random() * definitions.length)];
}

export function dealStrategyCards(state, team) {
  const developmentCount = 2 + Math.floor(Math.random() * 3);
  team.developmentCards = Array.from({ length: developmentCount }, () => ({
    ...draw(DEVELOPMENT_DEFINITIONS), id: nextId(state, 'dev'), kind: 'development', used: false,
  }));
  team.gameplanCards = Array.from({ length: 2 }, () => ({
    ...draw(GAMEPLAN_DEFINITIONS), id: nextId(state, 'gp'), kind: 'gameplan', used: false,
  }));
  team.seasonGameplanEffects = { offPercent: 0, defPercent: 0, benchBonus: 0, seedingPercent: 0 };
}

export function applyDevelopmentCard(state, teamIdx, cardId, playerId) {
  const team = state.teams[teamIdx];
  const card = team?.developmentCards?.find((c) => c.id === cardId);
  const player = team?.hand?.find((p) => String(p.id) === String(playerId));
  if (!card || card.used) return { ok: false, msg: 'That Development card is no longer available.' };
  if (!player) return { ok: false, msg: 'Choose a player on your roster.' };
  if (player.development) return { ok: false, msg: 'That player has already received career development.' };
  Object.entries(card.statChanges).forEach(([stat, value]) => { player.stats[stat] += value; });
  player.development = { cardName: card.name, description: card.description, statChanges: { ...card.statChanges }, season: state.season };
  card.used = true;
  card.playerId = player.id;
  return { ok: true };
}

function addEffects(target, effects) {
  target.offPercent = (target.offPercent || 0) + (effects.offPercent || 0);
  target.defPercent = (target.defPercent || 0) + (effects.defPercent || 0);
  target.benchBonus = (target.benchBonus || 0) + (effects.benchBonus || 0);
  target.seedingPercent = (target.seedingPercent || 0) + (effects.seedingPercent || 0);
}

export function applyGameplanToTurn(turn, side, card) {
  const own = side === 'a' ? turn.extraA : turn.extraB;
  const opponent = side === 'a' ? turn.extraB : turn.extraA;
  const target = card.target === 'opponent' ? opponent : own;
  addEffects(target, card.effects);
  turn.gameplanNotes ||= [];
  turn.gameplanNotes.push({ teamSide: side, cardName: card.name, description: card.description });
}

export function playGameplanCard(state, teamIdx, cardId, context, targetTeamId) {
  const team = state.teams[teamIdx];
  const card = team?.gameplanCards?.find((c) => c.id === cardId);
  if (!card || card.used) return { ok: false, msg: 'That Gameplan card is no longer available.' };
  if (!card.contexts.includes(context)) return { ok: false, msg: `That card cannot be used for a ${context} plan.` };

  if (context === 'season') {
    const seasonOpen = ['pullhand', 'pullmodifier', 'constructing', 'teamsummary'].includes(state.phase);
    if (!seasonOpen) return { ok: false, msg: 'The regular season has already been summed.' };
    const target = card.target === 'opponent' ? state.teams.find((t) => String(t.id) === String(targetTeamId)) : team;
    if (!target || (card.target === 'opponent' && target === team)) return { ok: false, msg: 'Choose an opponent.' };
    target.seasonGameplanEffects ||= { offPercent: 0, defPercent: 0, benchBonus: 0, seedingPercent: 0 };
    addEffects(target.seasonGameplanEffects, card.effects);
    card.used = true;
    card.playedContext = 'season';
    card.targetTeamId = target.id;
    return { ok: true };
  }

  const match = state.playoff?.matches?.[state.playoff.activeMatchIndex];
  if (!match?.turn || match.result || !['coinflip', 'coinflipped'].includes(match.turn.stage)) return { ok: false, msg: 'Gameplans must be played before the matchup begins.' };
  const side = match.a === team ? 'a' : match.b === team ? 'b' : null;
  if (!side) return { ok: false, msg: 'Your team is not in this matchup.' };
  applyGameplanToTurn(match.turn, side, card);
  card.used = true;
  card.playedContext = 'playoff';
  card.targetTeamId = card.target === 'opponent' ? (side === 'a' ? match.b.id : match.a.id) : team.id;
  return { ok: true };
}

export function autoPlaySeasonGameplans(state, team) {
  for (const card of team.gameplanCards || []) {
    if (card.used || !card.contexts.includes('season')) continue;
    const target = card.target === 'opponent'
      ? state.teams.filter((t) => t !== team).sort((a, b) => (b.seed || 0) - (a.seed || 0))[0]
      : team;
    target.seasonGameplanEffects ||= { offPercent: 0, defPercent: 0, benchBonus: 0, seedingPercent: 0 };
    addEffects(target.seasonGameplanEffects, card.effects);
    card.used = true;
    card.playedContext = 'season';
    card.targetTeamId = target.id;
    break;
  }
}
