// State that comes back from Firestore is plain JSON — any place the original code stored a
// direct object reference to a team (so `===` comparisons and shared mutations worked) instead
// gets a structurally-identical but distinct copy after every read. This walks the known
// reference sites and relinks them back to the matching object in state.teams (matched by the
// stable `id` set in season.js's buildTeams), so the rest of the codebase — which was written
// assuming object identity — keeps working unmodified.
function migratePlayerTier(card) {
  if (card?.archetype === 'Bench Player') card.archetype = 'Journeyman';
  if (card?.tierName === 'Bench Player') card.tierName = 'Journeyman';
}

export function rehydrateState(state) {
  if (!state || !state.teams) return state;
  state.strategyCardCounter ||= 0;
  state.freeAgentCoachCounter ||= 0;
  state.freeAgentCoaches ||= [];
  state.teams.forEach((team) => {
    team.developmentCards ||= [];
    team.gameplanCards ||= [];
    team.seasonGameplanEffects ||= { offPercent: 0, defPercent: 0, benchBonus: 0, seedingPercent: 0 };
    (team.hand || []).forEach(migratePlayerTier);
    (team.deadCap || []).forEach((entry) => migratePlayerTier(entry.player));
  });
  (state.freeAgents || []).forEach(migratePlayerTier);
  (state.starPool || []).forEach(migratePlayerTier);
  (state.draft?.pool || []).forEach(migratePlayerTier);
  (state.draft?.picks || []).forEach((pick) => migratePlayerTier(pick.card));
  const byId = new Map(state.teams.map((t) => [t.id, t]));
  const relink = (ref) => (ref && ref.id != null ? byId.get(ref.id) ?? ref : ref);

  if (state.seeds) state.seeds.forEach((s) => { s.t = relink(s.t); });
  if (state.playoffTeams) state.playoffTeams = state.playoffTeams.map(relink);

  if (state.playoff && state.playoff.matches) {
    state.playoff.matches.forEach((m) => {
      m.a = relink(m.a);
      m.b = relink(m.b);
      if (m.turn && m.turn.order) { m.turn.order = m.turn.order.map(relink); }
      if (m.result) {
        m.result.a = relink(m.result.a);
        m.result.b = relink(m.result.b);
        m.result.winner = relink(m.result.winner);
      }
    });
  }

  if (state.draft) {
    state.draft.queue = (state.draft.queue || []).map(relink);
  }

  if (state.lastResult) {
    if (state.lastResult.seeds) state.lastResult.seeds.forEach((s) => { s.t = relink(s.t); });
    state.lastResult.winner = relink(state.lastResult.winner);
    if (state.lastResult.matches) {
      state.lastResult.matches.forEach((m) => {
        if (m.result) {
          m.result.a = relink(m.result.a);
          m.result.b = relink(m.result.b);
          m.result.winner = relink(m.result.winner);
        }
      });
    }
  }

  return state;
}
