import { acquireOffseasonPlayer } from './gm';
import { TIERS, POSITIONS, REPLACEMENT_TIER, ERA_LENGTH, LEAGUE_TEAM_COUNT, FORFEIT_BONUS_MAX, FORFEIT_BONUS_MIN } from './constants';
import { makeCard, randomArch, randomArchForTier, cardTotal, neededPosition } from './cards';
import { autoSelectFive } from './roster';
import { startNewSeasonRoster } from './season';
import { recordFreeAgencyActivity } from './freeAgencyActivity';
import { shuffle } from './rng';

// Extra cards beyond the one selection per team, so there's real choice (and something
// worth trading for) at the draft table.
const DRAFT_POOL_PADDING = 5;

// TIERS' `count` is each tier's actual quantity in a class, not a per-pick probability weight —
// a fixed bag of exactly 7 Role Player / 4 Journeyman / 4 High IQ / 4 Hustler / 2 Generational
// Talent (21 cards) shuffled and drawn from without replacement. Drawing each pick independently
// with `count` as a weight (the previous approach) gave the same ~9.5% average odds per
// Generational Talent slot, but with no cap — a class could occasionally draw three, four, or
// more by chance, when the whole point of "2 Generational Talents" is that there are only ever
// two to be had.
//
// Draft prospects never roll Journeyman — every prospect enters the league Young (see
// buildDraftPool below), and "journeyman" describes a well-traveled veteran, not a rookie who
// hasn't played a season yet. This bag drops those 4 slots entirely rather than redistributing
// them, so the remaining tiers' own counts stay exactly what they are everywhere else — only the
// total shrinks (21 -> 17).
const ROOKIE_TIERS = TIERS.filter((tier) => tier.name !== 'Journeyman');

function buildTierBag(tierPool = TIERS) {
  const bag = tierPool.flatMap((tier) => Array(tier.count).fill(tier));
  shuffle(bag);
  return bag;
}

// Draft prospects use Player Modifiers only. Every prospect enters the league Young;
// accolades are earned distinctions and never generated in the draft pool.
export function buildDraftPool(state, count) {
  const cards = [];
  let bag = buildTierBag(ROOKIE_TIERS);
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) bag = buildTierBag(ROOKIE_TIERS);
    const tier = bag.pop();
    const posPool = tier.allowedPositions || POSITIONS;
    const pos = posPool[Math.floor(Math.random() * posPool.length)];
    const card = makeCard(state, randomArchForTier(tier), pos, tier, 'Young');
    cards.push(card);
  }
  return cards;
}

// Every team receives one pick, even when that temporarily takes its roster above nine — so the
// pool's real size (LEAGUE_TEAM_COUNT + padding) is knowable before the season's even played,
// independent of who's actually still in the league or how they finish. That's what makes a
// true preview possible: prepareDraftClass below generates the exact class startDraft will use
// months before anyone's seed is known.
function buildPickQueue(teams, order) {
  return order.filter((t) => teams.includes(t));
}

// Called once per season (initFrontOffice for season 1, startNewSeasonRoster after) — see
// season.js. Lets the sidebar's Draft Class screen show this year's actual upcoming prospects
// (not a throwaway guess) for as long as the season plays out, right up until startDraft
// consumes it as the real pool.
export function prepareDraftClass(state) {
  state.upcomingDraftPool = buildDraftPool(state, LEAGUE_TEAM_COUNT + DRAFT_POOL_PADDING);
}

export function startDraft(state) {
  const order = [...state.seeds].reverse().map((s) => s.t); // worst record picks first
  const queue = buildPickQueue(state.teams, order);
  state.draft = {
    pool: state.upcomingDraftPool && state.upcomingDraftPool.length ? state.upcomingDraftPool : buildDraftPool(state, queue.length + DRAFT_POOL_PADDING),
    queue,
    picks: [],
  };
  state.upcomingDraftPool = null;
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

// This is a single-round draft (buildPickQueue gives exactly one slot per team), so whoever is
// on the clock right now sits at overall position (teams already through the queue) + 1 —
// counting every queue slot consumed so far, forfeits included, not just draft.picks (which
// only logs actual card picks).
export function overallPickPosition(state) {
  return LEAGUE_TEAM_COUNT - state.draft.queue.length + 1;
}

// Scales linearly from FORFEIT_BONUS_MAX at the 1st overall pick down to FORFEIT_BONUS_MIN at
// the last — mirrors that an early pick (worst record, first choice of the pool) was worth more
// than a late one, so giving it up should pay more too. Rounded to the same 0.25 granularity
// salaries use.
export function forfeitBonusForPosition(position) {
  const span = LEAGUE_TEAM_COUNT - 1;
  const raw = span <= 0 ? FORFEIT_BONUS_MAX : FORFEIT_BONUS_MAX - ((position - 1) * (FORFEIT_BONUS_MAX - FORFEIT_BONUS_MIN)) / span;
  return Math.round(raw * 4) / 4;
}

// Pass on this pick entirely for a cap bonus next season, scaled by how valuable the forfeited
// pick was — reuses draftTradeBonus (see economy.js, where it's applied once then reset to 0).
export function forfeitPick(state, teamIdx) {
  if (state.phase !== 'draft') return { ok: false, msg: 'The draft is closed.' };
  const human = state.draft.queue[0];
  if (!human || !human.human || human.id !== state.teams[teamIdx].id) return;
  human.draftTradeBonus = (human.draftTradeBonus || 0) + forfeitBonusForPosition(overallPickPosition(state));
  state.draft.queue.shift();
  resolveAiPicksUntilHuman(state);
  return { ok: true };
}
