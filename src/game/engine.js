import { applySupplementalCard } from './supplementalEffects';
// Action layer — each function mutates `state` in place, exactly like nine-deep.html's
// "G.foo = ...; render();" functions did (minus the render() call, which the caller does).
// This mirrors the original on purpose: Phase 3 of the multiplayer brief turns each of these
// into "mutate a draft, write it to Firestore" instead of "mutate G, call render()" — keeping
// the same shape here makes that swap mechanical instead of a rewrite.
//
// Every action that acts "as a particular team" takes that team's index explicitly (teamIdx)
// instead of assuming state.teams[0] — in solo mode the caller always passes 0; in a shared
// room, the caller resolves teamIdx from the acting player's own seat (ownerUid) first. See
// game/useLocalGame.js and game/useRoomGame.js for the two callers.
import { drawMatchupModifierCard } from './cards';
import { MATCHUP_CARD_DRAW_COUNT, HOME_COURT_BONUS } from './constants';
import { autoSelectFive, autoValidFive, validateLineup } from './roster';
import {
  buildStarPool, buildTeams, defaultSoloSeats, dealHands, initFrontOffice,
  initSeasonModifierCards, lockSeasonAndSeed, startPlayoffs,
} from './season';
import {
  checkInjury, playCardEffect, playMatchup, wantsAdvantage, cardChoicesFor, playableCards,
  isMatchUnlocked, hasHomeCourt, applyLiveFanbaseMod, matchTeams,
} from './matchup';
import { rosterSalary } from './economy';
import { applyPlayoffWinMilestone, fanbaseEnabled } from './fanbase';
import { applyGameplanToTurn } from './strategyCards';
import { beginTurn as initializeTurn } from './turn';

function humanTeams(state) {
  return state.teams.filter((t) => t.human);
}
function allHumansReady(state, predicate) {
  return humanTeams(state).every(predicate);
}

// The Deal (design ref 4A): hand, Front Office, and the first season's Matchup Cards are all
// dealt together here, synchronously, instead of across three separate pull screens — see
// DealScreen.jsx, the one screen that shows all of it. Moving on from there (past DealScreen,
// to Team Summary) is a purely local per-client decision now (see GameShell's pastDeal) —
// state.phase just stays 'pullhand' the whole time every player is reviewing their own roster,
// so nobody's Continue click yanks anyone else's screen; confirmLineup is what actually
// advances the shared game once every human is ready. initFrontOffice and
// initSeasonModifierCards still do the real per-team dealing work exactly as before (and
// still run this same way every season after the first, via startNewSeasonRoster — only
// Matchup Cards refresh season to season, so that's the only one with a recurring pull
// screen); called back to back here, each one's own phase assignment is simply overridden by
// the next line rather than shown.
export function startEra(state, teamNameRaw) {
  const val = (teamNameRaw || '').trim();
  if (!val.length) return false;
  state.teamName = val.slice(0, 32);
  state.eraId = Date.now();
  buildStarPool(state);
  buildTeams(state, defaultSoloSeats(state.teamName));
  dealHands(state);
  state.teams.forEach((t) => { t.activeIds = autoSelectFive(t.hand); if (!t.human) t.lineupSet = true; });
  initFrontOffice(state);
  initSeasonModifierCards(state);
  state.phase = 'pullhand';
  return true;
}

// Legacy fallback from an earlier deal sequence — nothing sets state.phase to 'cardoverview'
// any more, so this never actually runs, but it's cheap to keep around.
export function proceedFromCardOverview(state) {
  if (state.phase !== 'cardoverview') return;
  dealHands(state);
  state.teams.forEach((t) => { t.activeIds = autoSelectFive(t.hand); if (!t.human) t.lineupSet = true; });
  state.phase = 'pullhand';
}

// Only moves on to Matchup Cards once every human-controlled team has pulled its Front
// Office cards. Still used by the online room flow (see lobby.js's startEraOnline, which
// deals Front Office on its own rather than through startEra above) — PullCardsScreen's
// Continue button calls this directly.
export function proceedToSeason1(state) {
  const needsFanbase = fanbaseEnabled(state);
  if (!allHumansReady(state, (t) => t.coach && t.market && (!needsFanbase || t.fanbaseArchetype))) return;
  initSeasonModifierCards(state);
}

export function pullMatchupCard(state, teamIdx) {
  const team = state.teams[teamIdx];
  team.matchupCards ||= [];
  if (team.matchupCards.length >= MATCHUP_CARD_DRAW_COUNT) return;
  const card = drawMatchupModifierCard(state);
  if (card) team.matchupCards.push(card);
}
// One-click Matchup Cards pull — deals all MATCHUP_CARD_DRAW_COUNT at once.
export function pullAllMatchupCards(state, teamIdx) {
  const team = state.teams[teamIdx];
  team.matchupCards ||= [];
  while (team.matchupCards.length < MATCHUP_CARD_DRAW_COUNT) {
    const card = drawMatchupModifierCard(state);
    if (!card) break;
    team.matchupCards.push(card);
  }
}

// Only moves on once every human-controlled team has pulled all its cards — into the
// "constructing" loading screen, not straight to the lineup, so there's a beat before the
// persistent bar (which stays empty through the whole Front Office / Hand / Matchup Cards
// sequence) populates with the finished roster.
export function proceedToLineupFromModifier(state) {
  if (!allHumansReady(state, (t) => (t.matchupCards || []).length >= MATCHUP_CARD_DRAW_COUNT)) return;
  state.phase = 'constructing';
}

// Called automatically by the constructing screen's loading sequence once it finishes —
// not a user action, just the final step of the onboarding flow. Team Summary (1a, "the
// file") is shown next, after Matchup Cards and the loading beat — its own Continue button
// calls confirmLineup directly on the auto-selected five (see below); there's no separate
// manual lineup-picking screen any more.
export function finishConstruction(state) {
  if (state.phase !== 'constructing') return;
  state.phase = 'teamsummary';
}

// Called automatically by the simulating-season screen's loading sequence once it finishes.
// The actual seeding/cap-lock work already happened synchronously in lockSeasonAndSeed (see
// confirmLineup) — this is just the final step of that themed pause before Standings appears.
export function finishSeasonSimulation(state) {
  if (state.phase !== 'simulating') return;
  state.phase = 'standings';
}

// Each human team confirms its own lineup independently; AI lineups are auto-set and the
// season actually locks (seeding, etc.) only once every human has confirmed.
export function confirmLineup(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team.coach) return { valid: false, msg: 'Hire a coach before the season begins.' };
  if (team.hand.length !== 9) return { valid: false, msg: `Resolve your roster before the season begins. You currently have ${team.hand.length} of 9 players.` };
  const committed = rosterSalary(team);
  if (committed > team.seasonCap) return { valid: false, msg: `Get under budget before the season begins. You are using ${committed} of ${team.seasonCap}.` };
  if (!team.lineupSet) return { valid: false, msg: 'Set your lineup before the season begins.' };
  const v = validateLineup(team);
  if (!v.valid) return v;
  team.lineupConfirmed = true;
  if (allHumansReady(state, (t) => t.lineupConfirmed)) {
    state.teams.filter((t) => !t.human).forEach((t) => { t.activeIds = autoSelectFive(t.hand); t.lineupSet = true; });
    lockSeasonAndSeed(state);
  }
  return { valid: true };
}

// Set from the Set Lineup screen ("The Floor") once the user is happy with their starting
// five — distinct from confirmLineup, which locks the season for everyone; this just marks
// that a human has actually reviewed their own lineup at least once this season, so
// confirmLineup (and the top bar's projections) can require it without forcing a second,
// redundant confirmation step.
export function markLineupSet(state, teamIdx) {
  const team = state.teams[teamIdx];
  const v = validateLineup(team);
  if (!v.valid) return v;
  team.lineupSet = true;
  return { valid: true };
}

// Empties the starting five so the Set Lineup screen can open onto nine empty-looking slots
// instead of the auto-selected placeholder (see SetLineupScreen.jsx's mount effect) — only
// ever called pre-season, before lineupSet is true, so there's nothing live to protect here
// the way swapStarter/promoteToStarter protect a mid-match lineup.
export function clearLineup(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team) return { ok: false, msg: 'Nothing to clear yet.' };
  team.activeIds = [];
  return { ok: true };
}

// The Set Lineup screen's "Auto Set" button — a valid five (one Guard, one Forward, one Big,
// two more at random), never the strongest one. See autoValidFive's own note for why that
// distinction matters: this is an escape hatch for someone who doesn't want to hand-pick, not
// a "do it optimally for me" shortcut.
export function autoSetLineup(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (!team) return { ok: false, msg: 'Nothing to set yet.' };
  team.activeIds = autoValidFive(team.hand);
  return { ok: true };
}

export function beginPlayoffs(state) {
  startPlayoffs(state);
}

export function openSeries(state, matchIndex, teamIdx) {
  const match = state.playoff?.matches?.[matchIndex];
  if (!match || match.result || !isMatchUnlocked(state.playoff.matches, match)) {
    if (match?.result) state.playoff.activeMatchIndex = matchIndex;
    return match?.result ? { ok: true, review: true } : { ok: false, msg: 'This series is not ready.' };
  }
  const { a, b } = matchTeams(state.playoff.matches, match);
  const humans = [a, b].filter((team) => team?.human);
  const caller = state.teams[teamIdx];
  if (humans.length && !humans.some((team) => team.id === caller?.id)) return { ok: false, msg: 'Only a player in this series can start it.' };
  if (humans.length === 2) {
    match.readyTeamIds ||= [];
    if (!match.readyTeamIds.includes(caller.id)) match.readyTeamIds.push(caller.id);
    if (!humans.every((team) => match.readyTeamIds.includes(team.id))) return { ok: true, waiting: true };
  }
  state.playoff.activeMatchIndex = matchIndex;
  initializeTurn(state);
  return { ok: true };
}
export function closeSeries(state) {
  state.playoff.activeMatchIndex = null;
}

function myChoices(state, teamIdx) {
  state.playoff.cardChoices ||= {};
  const team = state.teams[teamIdx];
  return (state.playoff.cardChoices[team.id] ||= { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false });
}
export function toggleAdvantage(state, teamIdx) {
  const c = myChoices(state, teamIdx);
  c.useAdvantage = !c.useAdvantage;
}

// The instant, one-shot resolver — used only by simulateAllPlayoffs' fast-forward now that a
// human-watched match plays out turn by turn instead (see game/turn.js's beginTurn/advanceTurn,
// wired up in PlayoffSeriesScreen). Produces the same m.result shape either way, since
// MatchupBox/ResultsScreen/SeasonRecapScreen read it without caring which path produced it.
export function rollCurrentMatchup(state) {
  const m = state.playoff.matches[state.playoff.activeMatchIndex];
  if (m.from) {
    m.a = state.playoff.matches[m.from[0]].result.winner;
    m.b = state.playoff.matches[m.from[1]].result.winner;
  }
  const advA = wantsAdvantage(m.a, state.playoff);
  const advB = wantsAdvantage(m.b, state.playoff);
  if (advA) m.a.advantageAvailable = false;
  if (advB) m.b.advantageAvailable = false;
  const injuryChance = state.settings.injuryChance;
  const injA = checkInjury(m.a, injuryChance);
  const injB = checkInjury(m.b, injuryChance);
  let idsA = injA.ids, idsB = injB.ids;
  const extraA = { offDelta: 0, defDelta: 0, leagueMod: 0 };
  const extraB = { offDelta: 0, defDelta: 0, leagueMod: 0 };
  const cardNotes = [];

  const hcaA = hasHomeCourt(m.a, m.b);
  const hcaB = hasHomeCourt(m.b, m.a);
  if (hcaA) { extraA.offPercent = (extraA.offPercent || 0) + HOME_COURT_BONUS; extraA.defPercent = (extraA.defPercent || 0) + HOME_COURT_BONUS; }
  if (hcaB) { extraB.offPercent = (extraB.offPercent || 0) + HOME_COURT_BONUS; extraB.defPercent = (extraB.defPercent || 0) + HOME_COURT_BONUS; }

  idsB = applyLiveFanbaseMod(m.a, m.b, extraA, idsB, cardNotes);
  idsA = applyLiveFanbaseMod(m.b, m.a, extraB, idsA, cardNotes);

  const planTurn = { extraA, extraB, gameplanNotes: [] };
  for (const [side, team] of [['a', m.a], ['b', m.b]]) {
    if (team.human) continue;
    const plan = (team.gameplanCards || []).find((card) => !card.used && card.contexts?.includes('playoff'));
    if (!plan) continue;
    applyGameplanToTurn(planTurn, side, plan);
    plan.used = true;
    plan.playedContext = 'playoff';
    plan.targetTeamId = plan.target === 'opponent' ? (side === 'a' ? m.b.id : m.a.id) : team.id;
  }

  const choicesA = cardChoicesFor(state.playoff, m.a);
  const choicesB = cardChoicesFor(state.playoff, m.b);
  // AI plays the first eligible card it's holding, targeting a random opposing player when the
  // card needs one; a human plays whichever one (and whichever target) they selected in the UI.
  function cardToPlay(team, choices) {
    const options = playableCards(team);
    if (!options.length) return { card: null, targetId: null };
    if (!team.human) return { card: options[0], targetId: null };
    const card = options.find((c) => c.id === choices.selectedCardId) || null;
    return { card, targetId: card ? choices.selectedTargetId : null };
  }
  const a = cardToPlay(m.a, choicesA);
  const b = cardToPlay(m.b, choicesB);

  if (a.card?.effectType) {
    const note = applySupplementalCard(state, m.a, m.b, a.card, extraA, extraB, idsA, idsB, a.targetId, choicesA.selectedStat || 'SCO');
    if (note) cardNotes.push({ text: note, cardName: a.card.name });
  } else if (a.card) {
    const res = playCardEffect(m.a, m.b, idsB, state.playoff, a.card, a.targetId);
    idsB = res.targetIds;
    extraA.offDelta += res.userOffDelta; extraA.defDelta += res.userDefDelta; extraA.leagueMod += res.userLeagueMod;
    extraB.offDelta += res.targetOffDelta; extraB.defDelta += res.targetDefDelta;
    if (res.note) cardNotes.push({ text: res.note, cardName: res.cardName });
  }
  if (b.card?.effectType) {
    const note = applySupplementalCard(state, m.b, m.a, b.card, extraB, extraA, idsB, idsA, b.targetId, choicesB.selectedStat || 'SCO');
    if (note) cardNotes.push({ text: note, cardName: b.card.name });
  } else if (b.card && !b.card.used) {
    const res = playCardEffect(m.b, m.a, idsA, state.playoff, b.card, b.targetId);
    idsA = res.targetIds;
    extraB.offDelta += res.userOffDelta; extraB.defDelta += res.userDefDelta; extraB.leagueMod += res.userLeagueMod;
    extraA.offDelta += res.targetOffDelta; extraA.defDelta += res.targetDefDelta;
    if (res.note) cardNotes.push({ text: res.note, cardName: res.cardName });
  }

  m.result = playMatchup(m.a, m.b, advA, advB, idsA, idsB, extraA, extraB);
  m.result.injA = injA;
  m.result.injB = injB;
  m.result.cardNotes = cardNotes;
  m.result.aExtra = extraA;
  m.result.bExtra = extraB;
  m.result.hcaA = hcaA;
  m.result.hcaB = hcaB;
  applyPlayoffWinMilestone(m.result.winner);
  state.playoff.cardChoices ||= {};
  state.playoff.cardChoices[m.a.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
  state.playoff.cardChoices[m.b.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
}

// Resolves every remaining playoff match automatically, round by round — a fast-forward for
// players who don't want to click through each series. Any card/advantage choice a human
// already queued up for the match currently open is used; every other match (including any
// human match reached along the way) rolls with no cards played and no advantage used, same
// as an AI team with nothing selected. Leaves the bracket screen showing final results.
export function simulateAllPlayoffs(state) {
  const matches = state.playoff.matches;
  while (matches.some((m) => !m.result)) {
    const idx = matches.findIndex((m) => {
      if (m.result || !isMatchUnlocked(matches, m)) return false;
      const { a, b } = matchTeams(matches, m);
      return !a.human && !b.human;
    });
    if (idx < 0) break;
    state.playoff.activeMatchIndex = idx;
    rollCurrentMatchup(state);
  }
  state.playoff.activeMatchIndex = null;
}

// Same instant resolver as Simulate All, scoped to one match — for a bracket click that just
// wants this series decided (including a human-involved one) without playing it turn by turn.
export function simulateOneMatch(state, index) {
  const matches = state.playoff.matches;
  const m = matches[index];
  if (!m || m.result || !isMatchUnlocked(matches, m)) return { ok: false, msg: 'This match cannot be simulated right now.' };
  const { a, b } = matchTeams(matches, m);
  if (a.human && b.human) return { ok: false, msg: 'A series between two human players must be played.' };
  const prevActive = state.playoff.activeMatchIndex;
  state.playoff.activeMatchIndex = index;
  rollCurrentMatchup(state);
  state.playoff.activeMatchIndex = prevActive === index ? null : prevActive;
  return { ok: true };
}

export function updateSettings(state, patch) {
  state.settings = { ...state.settings, ...patch };
}

// Starting-five edits — from the once-per-season Team Summary confirm step, or (per the
// persistent bar's "slot drag reorders within a group and moves players between starters and
// bench" behaviour) any time from the bar itself. The only hard block is a match this team is
// actively playing turn-by-turn: swapping mid-turn would edit a lineup the turn engine has
// already rolled dice against.
export function swapStarter(state, teamIdx, outgoingId, incomingId) {
  const team = state.teams[teamIdx];
  if (!team || !team.hand || !team.activeIds || team.activeIds.length !== 5) return { ok: false, msg: 'Nothing to substitute yet.' };
  const inLiveMatch = state.playoff && state.playoff.matches.some((m) => m.turn && !m.result && (m.a === team || m.b === team));
  if (inLiveMatch) return { ok: false, msg: "Can't change your lineup mid-match." };
  if (!team.activeIds.includes(outgoingId) || team.activeIds.includes(incomingId) || !team.hand.some((p) => p.id === incomingId)) return { ok: false, msg: 'Choose a starter and a bench player.' };
  const activeIds = team.activeIds.map((id) => id === outgoingId ? incomingId : id);
  const validation = validateLineup({ ...team, activeIds });
  if (!validation.valid) return { ok: false, msg: validation.msg };
  team.activeIds = activeIds;
  return { ok: true };
}

// Sends a starter back to the bench with no incoming replacement — the minus button on the
// Set Lineup screen's court slots. Symmetrical to promoteToStarter below; together the two
// let a slot go starter -> empty -> (a different) starter without ever needing a full five to
// route through swapStarter.
export function demoteStarter(state, teamIdx, outgoingId) {
  const team = state.teams[teamIdx];
  if (!team || !team.activeIds) return { ok: false, msg: 'Nothing to bench yet.' };
  if (!team.activeIds.includes(outgoingId)) return { ok: false, msg: 'That player is not a starter.' };
  const inLiveMatch = state.playoff && state.playoff.matches.some((m) => m.turn && !m.result && (m.a === team || m.b === team));
  if (inLiveMatch) return { ok: false, msg: "Can't change your lineup mid-match." };
  team.activeIds = team.activeIds.filter((id) => id !== outgoingId);
  return { ok: true };
}

// Fills an open starting slot directly (no outgoing player) — the case swapStarter can't
// handle, since it always trades one active id for one bench id and refuses to run at all
// once activeIds.length !== 5. That gap opens up after releasePlayer cuts an active starter:
// activeIds shrinks below 5 and stays there until this fills it back up.
export function promoteToStarter(state, teamIdx, incomingId) {
  const team = state.teams[teamIdx];
  if (!team || !team.hand) return { ok: false, msg: 'Nothing to add yet.' };
  const activeIds = team.activeIds || [];
  if (activeIds.length >= 5) return { ok: false, msg: 'Your starting five is already full.' };
  if (activeIds.includes(incomingId) || !team.hand.some((p) => p.id === incomingId)) return { ok: false, msg: 'Choose a bench player.' };
  const inLiveMatch = state.playoff && state.playoff.matches.some((m) => m.turn && !m.result && (m.a === team || m.b === team));
  if (inLiveMatch) return { ok: false, msg: "Can't change your lineup mid-match." };
  const nextIds = [...activeIds, incomingId];
  if (nextIds.length === 5) {
    const validation = validateLineup({ ...team, activeIds: nextIds });
    if (!validation.valid) return { ok: false, msg: validation.msg };
  }
  team.activeIds = nextIds;
  return { ok: true };
}
