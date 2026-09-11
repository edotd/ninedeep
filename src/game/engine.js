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
import { drawCoachCard, applyCoachRetention, drawMatchupModifierCard } from './cards';
import { weightedPick } from './rng';
import { MARKETS, FANBASE_TYPES } from './constants';
import { finalizeCap, rollMarketCapAdj } from './economy';
import { autoSelectFive, validateLineup } from './roster';
import {
  buildStarPool, buildTeams, defaultSoloSeats, dealHands, initFrontOffice,
  initSeasonModifierCards, lockSeasonAndSeed, startPlayoffs,
} from './season';
import { checkInjury, playCardEffect, playMatchup, wantsAdvantage, cardChoicesFor } from './matchup';

function humanTeams(state) {
  return state.teams.filter((t) => t.human);
}
function allHumansReady(state, predicate) {
  return humanTeams(state).every(predicate);
}

export function startEra(state, teamNameRaw) {
  const val = (teamNameRaw || '').trim();
  state.teamName = val.length ? val.slice(0, 32) : 'Your Franchise';
  buildStarPool(state);
  buildTeams(state, defaultSoloSeats(state.teamName));
  initFrontOffice(state);
}

export function pullCoach(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.coach) return;
  team.coach = drawCoachCard();
  applyCoachRetention(team, team.coach);
}
export function pullFanbase(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.fanbase) return;
  team.fanbase = weightedPick(FANBASE_TYPES);
  team.attendance = team.fanbase.attendanceBase;
  team.advantageAvailable = team.fanbase.name === 'Die Hard';
}
export function pullMarket(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.market) return;
  const def = weightedPick(MARKETS);
  team.market = { name: def.name, capAdj: rollMarketCapAdj(def) };
  finalizeCap(team, state.season);
}

// Only deals hands once every human-controlled team has pulled its Front Office cards.
export function proceedToSeason1(state) {
  if (!allHumansReady(state, (t) => t.coach && t.fanbase && t.market)) return;
  dealHands(state);
  state.teams.forEach((t) => { t.activeIds = autoSelectFive(t.hand); });
  state.phase = 'pullhand';
}

export function proceedFromHand(state) {
  initSeasonModifierCards(state);
}

export function pullMatchupCard(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.matchupCard) return;
  team.matchupCard = drawMatchupModifierCard();
}

// Only moves to the lineup screen once every human-controlled team has its matchup card.
export function proceedToLineupFromModifier(state) {
  if (!allHumansReady(state, (t) => !!t.matchupCard)) return;
  state.phase = 'lineup';
}

export function toggleActive(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  const idx = team.activeIds.indexOf(cardId);
  if (idx >= 0) { team.activeIds.splice(idx, 1); }
  else if (team.activeIds.length < 5) { team.activeIds.push(cardId); }
}
export function autoSetHuman(state, teamIdx) {
  state.teams[teamIdx].activeIds = autoSelectFive(state.teams[teamIdx].hand);
}

// Each human team confirms its own lineup independently; AI lineups are auto-set and the
// season actually locks (seeding, etc.) only once every human has confirmed.
export function confirmLineup(state, teamIdx) {
  const team = state.teams[teamIdx];
  const v = validateLineup(team);
  if (!v.valid) return v;
  team.lineupConfirmed = true;
  if (allHumansReady(state, (t) => t.lineupConfirmed)) {
    state.teams.filter((t) => !t.human).forEach((t) => { t.activeIds = autoSelectFive(t.hand); });
    lockSeasonAndSeed(state);
  }
  return { valid: true };
}

export function beginPlayoffs(state) {
  startPlayoffs(state);
}

export function openSeries(state, matchIndex) {
  state.playoff.activeMatchIndex = matchIndex;
}
export function closeSeries(state) {
  state.playoff.activeMatchIndex = null;
}

function myChoices(state, teamIdx) {
  state.playoff.cardChoices ||= {};
  const team = state.teams[teamIdx];
  return (state.playoff.cardChoices[team.id] ||= { useAdvantage: false, useCard: false, useInjuryPrevention: false });
}
export function toggleAdvantage(state, teamIdx) {
  const c = myChoices(state, teamIdx);
  c.useAdvantage = !c.useAdvantage;
}
export function toggleCardPlay(state, teamIdx) {
  const c = myChoices(state, teamIdx);
  c.useCard = !c.useCard;
}
export function toggleInjuryPrevention(state, teamIdx) {
  const c = myChoices(state, teamIdx);
  c.useInjuryPrevention = !c.useInjuryPrevention;
}

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

  const choicesA = cardChoicesFor(state.playoff, m.a);
  const choicesB = cardChoicesFor(state.playoff, m.b);
  function eligible(team) { return team.matchupCard && !team.matchupCard.used && team.matchupCard.playable; }
  const aPlays = eligible(m.a) && (m.a.human ? choicesA.useCard : true);
  const bPlays = eligible(m.b) && (m.b.human ? choicesB.useCard : true);

  if (aPlays) {
    const res = playCardEffect(m.a, m.b, idsB, state.playoff);
    idsB = res.targetIds;
    extraA.offDelta += res.userOffDelta; extraA.defDelta += res.userDefDelta; extraA.leagueMod += res.userLeagueMod;
    extraB.offDelta += res.targetOffDelta; extraB.defDelta += res.targetDefDelta;
    if (res.note) cardNotes.push({ text: res.note, cardName: res.cardName });
  }
  if (bPlays) {
    const res = playCardEffect(m.b, m.a, idsA, state.playoff);
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
  state.playoff.cardChoices ||= {};
  state.playoff.cardChoices[m.a.id] = { useAdvantage: false, useCard: false, useInjuryPrevention: false };
  state.playoff.cardChoices[m.b.id] = { useAdvantage: false, useCard: false, useInjuryPrevention: false };
}

export function openGlossary(state) {
  if (state.phase === 'glossary') return;
  state.returnPhase = state.phase;
  state.phase = 'glossary';
}
export function closeGlossary(state) {
  state.phase = state.returnPhase || 'setup';
}

export function openLeague(state) {
  if (state.phase === 'league') return;
  state.returnPhase = state.phase;
  state.phase = 'league';
}
export function closeLeague(state) {
  state.phase = state.returnPhase || 'setup';
}

export function openSettings(state) {
  if (state.phase === 'settings') return;
  state.returnPhase = state.phase;
  state.phase = 'settings';
}
export function closeSettings(state) {
  state.phase = state.returnPhase || 'setup';
}
export function updateSettings(state, patch) {
  state.settings = { ...state.settings, ...patch };
}
