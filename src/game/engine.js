// Action layer — each function mutates `state` in place, exactly like nine-deep.html's
// "G.foo = ...; render();" functions did (minus the render() call, which the caller does).
// This mirrors the original on purpose: Phase 3 of the multiplayer brief turns each of these
// into "mutate a draft, write it to Firestore" instead of "mutate G, call render()" — keeping
// the same shape here makes that swap mechanical instead of a rewrite.
import { drawCoachCard, applyCoachRetention, drawMatchupModifierCard } from './cards';
import { weightedPick } from './rng';
import { MARKETS, FANBASE_TYPES } from './constants';
import { finalizeCap, rollMarketCapAdj } from './economy';
import { autoSelectFive, validateLineup } from './roster';
import {
  buildStarPool, buildTeams, defaultSoloSeats, dealHands, initFrontOffice,
  initSeasonModifierCards, lockSeasonAndSeed, startPlayoffs,
} from './season';
import { checkInjury, playCardEffect, playMatchup, wantsAdvantage } from './matchup';

export function startEra(state, teamNameRaw) {
  const val = (teamNameRaw || '').trim();
  state.teamName = val.length ? val.slice(0, 32) : 'Your Franchise';
  buildStarPool(state);
  buildTeams(state, defaultSoloSeats(state.teamName));
  initFrontOffice(state);
}

export function pullCoach(state) {
  const team = state.teams[0];
  if (team.coach) return;
  team.coach = drawCoachCard();
  applyCoachRetention(team, team.coach);
}
export function pullFanbase(state) {
  const team = state.teams[0];
  if (team.fanbase) return;
  team.fanbase = weightedPick(FANBASE_TYPES);
  team.attendance = team.fanbase.attendanceBase;
  team.advantageAvailable = team.fanbase.name === 'Die Hard';
}
export function pullMarket(state) {
  const team = state.teams[0];
  if (team.market) return;
  const def = weightedPick(MARKETS);
  team.market = { name: def.name, capAdj: rollMarketCapAdj(def) };
  finalizeCap(team, state.season);
}

export function proceedToSeason1(state) {
  const team = state.teams[0];
  if (!(team.coach && team.fanbase && team.market)) return;
  dealHands(state);
  state.teams.forEach((t) => { t.activeIds = autoSelectFive(t.hand); });
  state.phase = 'pullhand';
}

export function proceedFromHand(state) {
  initSeasonModifierCards(state);
}

export function pullMatchupCard(state) {
  const team = state.teams[0];
  if (team.matchupCard) return;
  team.matchupCard = drawMatchupModifierCard();
}

export function proceedToLineupFromModifier(state) {
  if (!state.teams[0].matchupCard) return;
  state.phase = 'lineup';
}

export function toggleActive(state, cardId) {
  const team = state.teams[0];
  const idx = team.activeIds.indexOf(cardId);
  if (idx >= 0) { team.activeIds.splice(idx, 1); }
  else if (team.activeIds.length < 5) { team.activeIds.push(cardId); }
}
export function autoSetHuman(state) {
  state.teams[0].activeIds = autoSelectFive(state.teams[0].hand);
}

export function confirmLineup(state) {
  const v = validateLineup(state.teams[0]);
  if (!v.valid) return v;
  state.teams.slice(1).forEach((t) => { t.activeIds = autoSelectFive(t.hand); });
  lockSeasonAndSeed(state);
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

export function toggleAdvantage(state) { state.playoff.useAdvantage = !state.playoff.useAdvantage; }
export function toggleCardPlay(state) { state.playoff.useCard = !state.playoff.useCard; }
export function toggleInjuryPrevention(state) { state.playoff.useInjuryPrevention = !state.playoff.useInjuryPrevention; }

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

  function eligible(team) { return team.matchupCard && !team.matchupCard.used && team.matchupCard.playable; }
  const aPlays = eligible(m.a) && (m.a.human ? state.playoff.useCard : true);
  const bPlays = eligible(m.b) && (m.b.human ? state.playoff.useCard : true);

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
  state.playoff.useAdvantage = false;
  state.playoff.useCard = false;
  state.playoff.useInjuryPrevention = false;
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
