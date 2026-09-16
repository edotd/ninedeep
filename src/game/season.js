import { addToRoster, creditTeamSeason } from './chemistry';
import { TIERS, LEAGUE_ACCOLADES, REPLACEMENT_TIER, AI_NAMES, AI_TRICODES, POSITIONS, CHAMPIONSHIP_BAR_MULT, INJURY_CHANCE, FANBASE_ARCHETYPES, MARKETS, GM_TYPES, MATCHUP_CARD_DRAW_COUNT } from './constants';
import { advanceCareer } from './aging';
import { shuffle, weightedPick } from './rng';
import { makeCard, randomArch, randomArchForTier, cardTotal, neededPosition, drawCoachCard, applyCoachRetention, drawMatchupModifierCard, resetMatchupDeck } from './cards';
import { finalizeCap, rosterSalary, rollMarketCapAdj } from './economy';
import { autoSelectFive, effectiveRating, validateLineup } from './roster';
import { startDraft } from './draft';
import { initAttendance, rollFanbaseMod, recomputeSeasonAttendance, applyPlayoffBerthMilestone, applyHomeCourtMilestone, applyChampionshipMilestone } from './fanbase';
import { tricodeFor } from './names';
import { simulateSeasonOutput } from './matchup';

export function newEraState() {
  return {
    season: 1,
    freeAgents: [],
    teams: [],
    phase: 'setup',
    starPool: [],
    lastExpiredPlayers: [],
    log: [],
    cardCounter: 0,
    settings: {
      injuryChance: INJURY_CHANCE,
      championshipBarMult: CHAMPIONSHIP_BAR_MULT,
      actionLogSpeed: 'normal',
      winCondition: 'outright', // 'bar' = must clear the championship bar; 'outright' = winning the Finals is enough
      matchupCardsEnabled: true,
    },
  };
}

export function buildStarPool(state) {
  state.starPool = [];
  [...TIERS, ...LEAGUE_ACCOLADES].forEach((tier) => {
    for (let i = 0; i < tier.count; i++) {
      const posPool = tier.allowedPositions || POSITIONS;
      const pos = posPool[Math.floor(Math.random() * posPool.length)];
      state.starPool.push(makeCard(state, randomArchForTier(tier), pos, tier));
    }
  });
  shuffle(state.starPool);
}

// teamSeats: array of { name, human, ownerUid } — seat 0 is always the primary/local seat in solo mode.
// Every team gets a stable `id` (its seat index) — once state round-trips through Firestore
// as JSON, object identity (team === otherTeam) no longer holds, so anything that needs to
// reference "this team" elsewhere in state (playoff matches, draft queue, seeds) must use
// this id instead. See game/rehydrate.js, which relinks object references by id after sync.
export function buildTeams(state, teamSeats) {
  state.teams = teamSeats.map((seat, id) => ({
    id,
    name: seat.name,
    tricode: tricodeFor(seat.name, AI_TRICODES),
    human: seat.human,
    ownerUid: seat.ownerUid ?? null,
    hand: [],
    titles: 0,
    playoffAppearances: 0,
    lastOverage: 0,
    retainedStreak: 0,
    lastCoachName: null,
    matchupCards: [],
    fanbaseBaseline: 0,
    financeBoostUsedThisSeason: false,
    // One entry pushed per season in proceedFromResults, feeding the Season Recap screen's
    // era ledger (result reached, cap used, players under contract) — see seasonResultForTeam.
    seasonHistory: [],
  }));
}

export function defaultSoloSeats(teamName) {
  return [{ name: teamName, human: true }, ...AI_NAMES.map((n) => ({ name: n, human: false }))];
}

// Shuffles the star pool and deals it out evenly (extras distributed randomly), then tops
// every team up to 9 cards with generic Undrafted fillers.
export function dealHands(state) {
  const teamCount = state.teams.length;
  const order = [...Array(teamCount).keys()];
  shuffle(order);
  const base = Math.floor(state.starPool.length / teamCount);
  const extraCount = state.starPool.length % teamCount;
  const extraSet = new Set(order.slice(0, extraCount));
  state.teams.forEach((team, idx) => {
    const count = base + (extraSet.has(idx) ? 1 : 0);
    for (let i = 0; i < count; i++) { addToRoster(team, state.starPool.pop()); }
  });
  state.teams.forEach((team) => {
    while (team.hand.length < 9) {
      addToRoster(team, makeCard(state, randomArch(), neededPosition(team) || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
    }
  });
}

export function refreshAdvantage(team) {
  team.advantageAvailable = !!(team.fanbaseArchetype && team.fanbaseArchetype.name === 'Die Hard');
}

// Runs once, right after team setup and before hands are dealt. Coach, Fanbase, and Market are
// pulled here for AI teams and kept for the whole era. Human teams pull their own via pullCoach etc.
export function initFrontOffice(state) {
  state.phase = 'pullcards';
  state.bar = undefined;
  state.leagueAvg = undefined;
  // Auto-dealt for every team, human or AI — same "no manual pull button" treatment as the
  // hand and matchup cards. PullCardsScreen just reveals what's already in state.
  state.teams.forEach((team) => {
    team.coach = drawCoachCard();
    applyCoachRetention(team, team.coach);
    team.fanbaseArchetype = weightedPick(FANBASE_ARCHETYPES);
    rollFanbaseMod(team);
    const marketDef = weightedPick(MARKETS);
    team.market = { name: marketDef.name, capAdj: rollMarketCapAdj(marketDef) };
    team.gmType = GM_TYPES[Math.floor(Math.random() * GM_TYPES.length)];
    initAttendance(team);
    refreshAdvantage(team);
    finalizeCap(team, state.season);
  });
}

export function initSeasonModifierCards(state) {
  state.bar = undefined;
  state.leagueAvg = undefined;
  // Fanbase mods are re-rolled every season for every team, independent of the Matchup
  // Cards setting — they're a fanbase mechanic, not a matchup one.
  state.teams.forEach((team) => { if (state.season > 1 || !team.fanbaseMod) rollFanbaseMod(team); });
  if (state.settings && state.settings.matchupCardsEnabled === false) {
    state.teams.forEach((team) => { team.matchupCards = []; });
    state.phase = 'constructing';
    return;
  }
  resetMatchupDeck(state);
  state.phase = 'pullmodifier';
  state.teams.forEach((team) => {
    team.matchupCards = Array.from({ length: MATCHUP_CARD_DRAW_COUNT }, () => drawMatchupModifierCard(state));
  });
}

// Runs at the start of every season after the first. Cards are already kept — this just refreshes
// season-scoped state (cap recompute, coach retention streak, Die Hard's once-per-season ability).
export function startNewSeasonRoster(state) {
  state.teams.forEach((team) => {
    applyCoachRetention(team, team.coach);
    refreshAdvantage(team);
    finalizeCap(team, state.season);
    if (!team.activeIds || !validateLineup(team).valid) team.activeIds = autoSelectFive(team.hand);
    team.lineupConfirmed = false;
    team.financeBoostUsedThisSeason = false;
  });
  initSeasonModifierCards(state);
}

export function seedTeam(state, n) {
  return state.seeds[n - 1].t;
}

// The seeding/cap-lock portion of the original confirmLineup(), run after every team's
// active five is finalized for the season.
export function lockSeasonAndSeed(state) {
  state.teams.forEach((team) => {
    const total9 = rosterSalary(team);
    let overage = Math.max(0, total9 - team.seasonCap);
    team.lastOverage = overage;
    team.total9Salary = total9;
    // Purely informational — see simulateSeasonOutput. Runs here (under the Simulating
    // Season loading beat, before Standings shows) rather than at matchup time; the player
    // never sees or plays these games, just the two averaged figures.
    const sim = simulateSeasonOutput(team);
    team.simOffenseAvg = sim.off;
    team.simDefenseAvg = sim.def;
  });

  const seeds = state.teams
    .map((t) => {
      let val = effectiveRating(t) * (0.9 + Math.random() * 0.2);
      const seedingCards = (t.matchupCards || []).filter((c) => c.effectType === 'SEEDING_PERCENT' && !c.used);
      val *= 1 + seedingCards.reduce((sum, c) => sum + c.value, 0) / 100;
      seedingCards.forEach((c) => { c.used = true; });
      if ((t.matchupCards || []).some((c) => !c.effectType && c.name === 'Favorable Schedule' && !c.used)) val *= 1.10;
      return { t, val };
    })
    .sort((a, b) => b.val - a.val);
  seeds.forEach((s, rank) => { s.t.seed = rank + 1; });
  state.seeds = seeds;
  state.playoffTeams = seeds.slice(0, 8).map((s) => s.t);
  state.playoffTeams.forEach((t) => {
    t.playoffAppearances = (t.playoffAppearances || 0) + 1;
    applyPlayoffBerthMilestone(t);
    if (t.seed <= 4) applyHomeCourtMilestone(t);
  });
  // Championship bar is set from the playoff field only — teams that missed the cut don't
  // drag the bar down (or up) for the teams that actually have a shot at the title.
  state.leagueAvg = state.playoffTeams.reduce((s, t) => s + effectiveRating(t), 0) / state.playoffTeams.length;
  state.barMult = (state.settings && state.settings.championshipBarMult) || CHAMPIONSHIP_BAR_MULT;
  state.bar = state.leagueAvg * state.barMult;
  // Standings appear after a themed "Simulating Season" loading beat, not instantly — see
  // SimulatingSeasonScreen / finishSeasonSimulation in engine.js.
  state.phase = 'simulating';
}

export function startPlayoffs(state) {
  state.phase = 'playoffs';
  state.playoff = {
    activeMatchIndex: null,
    cardChoices: {},
    matches: [
      { label: 'Quarterfinal 1', a: seedTeam(state, 1), b: seedTeam(state, 8), result: null },
      { label: 'Quarterfinal 2', a: seedTeam(state, 4), b: seedTeam(state, 5), result: null },
      { label: 'Quarterfinal 3', a: seedTeam(state, 2), b: seedTeam(state, 7), result: null },
      { label: 'Quarterfinal 4', a: seedTeam(state, 3), b: seedTeam(state, 6), result: null },
      { label: 'Semifinal 1', a: null, b: null, from: [0, 1], result: null },
      { label: 'Semifinal 2', a: null, b: null, from: [2, 3], result: null },
      { label: 'Final', a: null, b: null, from: [4, 5], result: null },
    ],
  };
}

export function seasonAvgScoreForTeam(state, team) {
  let total = 0, games = 0;
  state.playoff.matches.forEach((m) => {
    if (!m.result) return;
    if (m.result.a === team) { total += m.result.aSum; games++; }
    else if (m.result.b === team) { total += m.result.bSum; games++; }
  });
  return games ? total / games : 0;
}

export function finishPlayoffs(state) {
  const winner = state.playoff.matches[state.playoff.matches.length - 1].result.winner;
  const outright = state.settings && state.settings.winCondition === 'outright';
  const champion = outright ? winner : (effectiveRating(winner) >= state.bar ? winner : null);
  if (champion) { champion.titles++; applyChampionshipMilestone(champion); }

  state.lastResult = { seeds: state.seeds, matches: state.playoff.matches, winner, leagueAvg: state.leagueAvg, bar: state.bar, barMult: state.barMult, champion, outright };
  state.log.push({ season: state.season, champion: champion ? champion.name : null, bar: Math.round(state.bar), winner: winner.name });
  state.phase = 'results';
}

// How far a team got this postseason, for the Season Recap era ledger — 'MISSED' the
// playoffs entirely, 'R1'/'R2' lost in that round, 'FINALS' lost the Final, 'TITLE' won it
// and cleared the championship bar. Read from state.playoff/state.lastResult before
// startPlayoffs re-initializes them for the next season.
function seasonResultForTeam(state, team) {
  if (!state.playoffTeams || !state.playoffTeams.includes(team)) return 'MISSED';
  const matches = state.playoff.matches;
  const final = matches[matches.length - 1];
  if (final.result && final.result.winner === team) {
    return state.lastResult && state.lastResult.champion === team ? 'TITLE' : 'FINALS';
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.result && (m.result.a === team || m.result.b === team) && m.result.winner !== team) {
      if (i <= 3) return 'R1';
      if (i <= 5) return 'R2';
      return 'FINALS';
    }
  }
  return 'MISSED';
}

export function proceedFromResults(state) {
  if (state.phase !== 'results') return;
  state.teams.forEach((team) => { team.lastSeasonAvgScore = seasonAvgScoreForTeam(state, team); });
  recomputeSeasonAttendance(state);
  // Filed once, before contracts move — captures the season exactly as it was played
  // (result reached, full committed cap, all nine still on the roster).
  state.teams.forEach((team) => {
    team.seasonHistory ||= [];
    team.seasonHistory.push({
      season: state.season,
      result: seasonResultForTeam(state, team),
      capUsed: team.total9Salary !== undefined ? team.total9Salary : rosterSalary(team),
      underContract: team.hand.length,
    });
  });
  state.lastExpiredPlayers = [];
  state.offseason = { contractsFiled: {}, rosterFiled: {}, lineupFiled: {} };
  state.teams.forEach((team) => {
    creditTeamSeason(team, state.season);
    const kept = [];
    team.hand.forEach((c) => {
      c.contract--;
      advanceCareer(c);
      if (c.contract <= 0) {
        state.freeAgents.push(Object.assign({}, c, { contract: c.maxContract, lastTeamId: team.id }));
        if (team.human) state.lastExpiredPlayers.push(c);
      } else kept.push(c);
    });
    team.hand = kept;
  });
  // Season Recap (the era ledger) is filed here, between Results and the Draft — see
  // proceedFromSeasonRecap below, which is what actually calls startDraft.
  state.phase = 'seasonrecap';
}

export function proceedFromSeasonRecap(state) {
  if (state.phase !== 'seasonrecap') return;
  state.phase = 'contracts';
}

const allHumanFiled = (state, key) => state.teams.filter((t) => t.human).every((t) => state.offseason[key][t.id]);

export function fileContracts(state, teamIdx) {
  if (state.phase !== 'contracts' || !state.teams[teamIdx]?.human) return { ok: false, msg: 'Contracts are not open.' };
  state.offseason.contractsFiled[state.teams[teamIdx].id] = true;
  if (allHumanFiled(state, 'contractsFiled')) startDraft(state);
  return { ok: true };
}

export function renewExpiredContract(state, teamIdx, cardId) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'contracts' || !team?.human || state.offseason?.contractsFiled?.[team.id]) return { ok: false, msg: 'Contract decisions are closed.' };
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  const index = state.freeAgents.findIndex((c) => c.id === cardId && c.lastTeamId === team.id);
  if (index < 0) return { ok: false, msg: 'Player is not available for renewal.' };
  const [card] = state.freeAgents.splice(index, 1);
  addToRoster(team, card);
  return { ok: true };
}

export function fileRoster(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'roster' || !team?.human || team.hand.length !== 9) return { ok: false, msg: 'Fill all nine roster spots first.' };
  state.offseason.rosterFiled[team.id] = true;
  if (allHumanFiled(state, 'rosterFiled')) {
    state.teams.forEach((t) => { t.activeIds = autoSelectFive(t.hand); t.lineupConfirmed = false; });
    state.phase = 'offseasonlineup';
  }
  return { ok: true };
}

export function fileOffseasonLineup(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (state.phase !== 'offseasonlineup' || !team?.human) return { ok: false, msg: 'Lineups are not open.' };
  const { valid, msg } = validateLineup(team);
  if (!valid) return { ok: false, msg };
  state.offseason.lineupFiled[team.id] = true;
  if (allHumanFiled(state, 'lineupFiled')) {
    state.season++;
    if (state.season > 8) state.phase = 'era_end';
    else { startNewSeasonRoster(state); state.phase = 'seasontransition'; }
  }
  return { ok: true };
}

export function signFreeAgent(state, cardId, teamIdx) {
  if (state.phase !== 'freeagency') return { ok: false, msg: 'Free agency is closed.' };
  const idx = state.freeAgents.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, msg: 'Card not available.' };
  const team = state.teams[teamIdx];
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  const [card] = state.freeAgents.splice(idx, 1);
  addToRoster(team, card);
  return { ok: true };
}

export function signReplacement(state, teamIdx) {
  if (state.phase !== 'freeagency') return { ok: false, msg: 'Free agency is closed.' };
  const team = state.teams[teamIdx];
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  addToRoster(team, makeCard(state, randomArch(), neededPosition(team) || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
  return { ok: true };
}

export function finishFreeAgency(state) {
  if (state.phase !== 'freeagency') return { ok: false, msg: 'Free agency is closed.' };
  if (state.teams.some((t) => t.human && t.hand.length !== 9)) return { ok: false, msg: 'Every human team must fill its roster.' };
  state.teams.filter((t) => !t.human).forEach((team) => {
    while (team.hand.length < 9) {
      const need = neededPosition(team);
      const poolMatch = need ? state.freeAgents.find((c) => c.position === need) : null;
      if (poolMatch) {
        addToRoster(team, state.freeAgents.splice(state.freeAgents.indexOf(poolMatch), 1)[0]);
      } else if (state.freeAgents.length > 0 && !need) {
        let bestIdx = 0, bestVal = -1;
        state.freeAgents.forEach((c, i) => { const v = cardTotal(c); if (v > bestVal) { bestVal = v; bestIdx = i; } });
        const [card] = state.freeAgents.splice(bestIdx, 1);
        addToRoster(team, card);
      } else {
        addToRoster(team, makeCard(state, randomArch(), need || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
      }
    }
  });
  state.phase = 'roster';
  return { ok: true };
}

// The Odometer (design brand handoff, "Nine Deep Transitions" 2A) — a one-time beat between
// seasons, shown for every season after the first (the first has no "last season" to show).
// Not a loading state: it's the beat that says a new season has started and what it will be
// judged on.
export function proceedFromSeasonTransition(state) {
  if (state.phase !== 'seasontransition') return;
  state.phase = 'pullmodifier';
}
