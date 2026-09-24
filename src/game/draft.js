import { acquireOffseasonPlayer } from './gm';
import { TIERS, POSITIONS, REPLACEMENT_TIER, ERA_LENGTH } from './constants';
import { makeCard, randomArch, randomArchForTier, cardTotal, neededPosition } from './cards';
import { autoSelectFive } from './roster';
import { startNewSeasonRoster } from './season';
import { recordFreeAgencyActivity } from './freeAgencyActivity';

// Extra cards beyond the one selection per team, so there's real choice (and something
// worth trading for) at the draft table.
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

// Draft prospects use Player Modifiers only. Every prospect enters the league Young;
// accolades are earned distinctions and never generated in the draft pool.
export function buildDraftPool(state, count) {
  const tierPool = TIERS;
  const cards = [];
  for (let i = 0; i < count; i++) {
    const tier = pickWeightedTier(tierPool);
    const posPool = tier.allowedPositions || POSITIONS;
    const pos = posPool[Math.floor(Math.random() * posPool.length)];
    const card = makeCard(state, randomArchForTier(tier), pos, tier, 'Young');
    cards.push(card);
  }
  return cards;
}

// Every team receives one pick, even when that temporarily takes its roster above nine.
function buildPickQueue(teams, order) {
  return order.filter((t) => teams.includes(t));
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
  const signed = acquireOffseasonPlayer(team, card);
  state.draft.picks.unshift({ teamId: team.id, teamName: team.name, human: team.human, card: signed });
  state.draft.queue.shift();
}

function finishDraftIfDone(state) {
  if (state.draft.queue.length === 0 || state.draft.pool.length === 0) {
    state.teams.filter((team) => !team.human).forEach((team) => {
      while (team.hand.length > 9) {
        const released = team.hand.reduce((worst, card) => (cardTotal(card) < cardTotal(worst) ? card : worst), team.hand[0]);
        team.hand.splice(team.hand.indexOf(released), 1);
        team.activeIds = (team.activeIds || []).filter((id) => id !== released.id);
        const available = { ...released, contract: released.maxContract, lastTeamId: team.id };
        state.freeAgents.push(available);
        recordFreeAgencyActivity(state, 'released', available, team);
      }
      while (team.hand.length < 9) {
        const need = neededPosition(team);
        const candidates = need ? state.freeAgents.filter((c) => c.position === need) : state.freeAgents;
        const card = candidates.length
          ? candidates.reduce((best, c) => (cardTotal(c) > cardTotal(best) ? c : best), candidates[0])
          : makeCard(state, randomArch(), need || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER);
        const poolIndex = state.freeAgents.findIndex((c) => c.id === card.id);
        if (poolIndex >= 0) state.freeAgents.splice(poolIndex, 1);
        const signed = acquireOffseasonPlayer(team, card);
        recordFreeAgencyActivity(state, 'signed', signed, team);
      }
      team.activeIds = autoSelectFive(team.hand);
      team.lineupConfirmed = false;
      team.lineupSet = true;
    });
    state.teams.filter((team) => team.human).forEach((team) => {
      team.activeIds = autoSelectFive(team.hand);
      team.lineupConfirmed = false;
      team.lineupSet = false;
    });
    state.season++;
    if (state.season > ERA_LENGTH) state.phase = 'era_end';
    else {
      startNewSeasonRoster(state);
      state.phase = 'teamsummary';
    }
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
  if (state.phase !== 'draft') return { ok: false, msg: 'The draft is closed.' };
  const team = state.draft.queue[0];
  if (!team || !team.human || team.id !== state.teams[teamIdx].id) return;
  const card = state.draft.pool.find((c) => c.id === cardId);
  if (!card) return;
  assignPick(state, team, card);
  resolveAiPicksUntilHuman(state);
}

// Pass on this pick entirely for a flat cap bonus next season — reuses draftTradeBonus (see
// economy.js, where it's applied once then reset to 0).
export function forfeitPick(state, teamIdx) {
  if (state.phase !== 'draft') return { ok: false, msg: 'The draft is closed.' };
  const human = state.draft.queue[0];
  if (!human || !human.human || human.id !== state.teams[teamIdx].id) return;
  human.draftTradeBonus = (human.draftTradeBonus || 0) + 1;
  state.draft.queue.shift();
  resolveAiPicksUntilHuman(state);
  return { ok: true };
}
