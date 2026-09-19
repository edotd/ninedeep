import { jerseyNumber, playerGrade } from './cards';

const MAX_ACTIVITY = 40;

export function recordFreeAgencyActivity(state, type, card, team = null) {
  state.freeAgencyActivity ||= [];
  state.freeAgencyActivity.unshift({
    id: `${state.season}-${type}-${card.id}-${state.freeAgencyActivity.length}`,
    season: state.season,
    type,
    playerId: card.id,
    player: `#${jerseyNumber(card)} ${card.archetype || 'Player'}`,
    grade: card.stats ? playerGrade(card) : '—',
    position: card.position,
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
  });
  state.freeAgencyActivity = state.freeAgencyActivity.slice(0, MAX_ACTIVITY);
}
