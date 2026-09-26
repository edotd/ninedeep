import { jerseyNumber, playerGrade } from './cards';

const MAX_ACTIVITY = 40;

// `extra` merges arbitrary additional fields onto the entry — currently just `via: 'bid'`,
// which resolveFreeAgentBidding sets on a won open-market bid so a later recap (Draft Order's
// "you signed these players" modal) can show bid wins specifically, distinct from a renewal
// the negotiation modal already confirmed to the user directly, in the moment.
export function recordFreeAgencyActivity(state, type, card, team = null, extra = {}) {
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
    ...extra,
  });
  state.freeAgencyActivity = state.freeAgencyActivity.slice(0, MAX_ACTIVITY);
}
