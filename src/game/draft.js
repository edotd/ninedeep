import { TIERS, LEAGUE_ACCOLADES, POSITIONS } from './constants';
import { makeCard, randomArch, cardTotal, neededPosition } from './cards';

// Extra cards beyond exactly what's needed to fill every open roster spot, so there's
// real choice (and something worth trading for) at the draft table.
const DRAFT_POOL_PADDING = 5;

function pickWeightedTier(pool) {
  const total = pool.reduce((s, t) => s + t.count, 0);
  let r = Math.random() * total;
  for (const t of pool) {
    if (r < t.count) return t;
    r -= t.count;
  }
  return pool[pool.length - 1];
}

// Cards of varying rarity — drawn from the same tier pools (Player Modifiers + League
// Accolades) used to build the season-1 star pool, weighted by each tier's relative count.
export function buildDraftPool(state, count) {
  const tierPool = [...TIERS, ...LEAGUE_ACCOLADES];
  const cards = [];
  for (let i = 0; i < count; i++) {
    const tier = pickWeightedTier(tierPool);
    const posPool = tier.allowedPositions || POSITIONS;
    const pos = posPool[Math.floor(Math.random() * posPool.length)];
    cards.push(makeCard(state, randomArch(), pos, tier));
  }
  return cards;
}

// A flat, round-robin queue of team turns: worst-record team first each round, looping
// until every team has picked once for each of its open roster spots.
function buildPickQueue(teams, order) {
  const remaining = new Map(teams.map((t) => [t, Math.max(0, 9 - t.hand.length)]));
  const queue = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of order) {
      if (remaining.get(t) > 0) {
        queue.push(t);
        remaining.set(t, remaining.get(t) - 1);
        progress = true;
      }
    }
  }
  return queue;
}

export function startDraft(state) {
  const order = [...state.seeds].reverse().map((s) => s.t); // worst record picks first
  const queue = buildPickQueue(state.teams, order);
  state.draft = {
    pool: buildDraftPool(state, queue.length + DRAFT_POOL_PADDING),
    queue,
    picks: [],
  };
  state.phase = 'draft';
  resolveAiPicksUntilHuman(state);
}

function bestCardFor(team, pool) {
  const need = neededPosition(team);
  const candidates = need ? pool.filter((c) => c.position === need) : pool;
  const usable = candidates.length ? candidates : pool;
  return usable.reduce((best, c) => (cardTotal(c) > cardTotal(best) ? c : best), usable[0]);
}

function assignPick(state, team, card) {
  state.draft.pool = state.draft.pool.filter((c) => c.id !== card.id);
  team.hand.push(card);
  state.draft.picks.unshift({ teamId: team.id, teamName: team.name, human: team.human, card });
  state.draft.queue.shift();
}

function finishDraftIfDone(state) {
  if (state.draft.queue.length === 0 || state.draft.pool.length === 0) {
    state.phase = 'freeagency';
  }
}

function resolveAiPicksUntilHuman(state) {
  while (state.draft.queue.length && !state.draft.queue[0].human && state.draft.pool.length) {
    const team = state.draft.queue[0];
    assignPick(state, team, bestCardFor(team, state.draft.pool));
  }
  finishDraftIfDone(state);
}

// teamIdx is the acting player's own seat — the pick only applies if it's actually that
// team's turn (queue[0]), so one player can never draft on another's behalf.
export function draftPick(state, teamIdx, cardId) {
  const team = state.draft.queue[0];
  if (!team || !team.human || team.id !== state.teams[teamIdx].id) return;
  const card = state.draft.pool.find((c) => c.id === cardId);
  if (!card) return;
  assignPick(state, team, card);
  resolveAiPicksUntilHuman(state);
}

// Trade down: the human gives up their current (earlier) queue slot to swap places with
// a team picking later, taking that later slot in exchange for a cap bonus next season —
// a simplified stand-in for a real multi-asset trade negotiation (no other tradable
// resource — draft picks, future cap space — exists in the game yet).
export function tradeDown(state, teamIdx, partnerTeamIndex) {
  const queue = state.draft.queue;
  const human = queue[0];
  if (!human || !human.human || human.id !== state.teams[teamIdx].id) return;
  const partner = state.teams[partnerTeamIndex];
  const partnerSlot = queue.findIndex((t, i) => i > 0 && t === partner);
  if (partnerSlot < 0) return;
  queue[0] = partner;
  queue[partnerSlot] = human;
  human.draftTradeBonus = (human.draftTradeBonus || 0) + Math.max(0.5, partnerSlot * 0.5);
  resolveAiPicksUntilHuman(state);
}
