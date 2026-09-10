import { TIERS, REPLACEMENT_TIER, AI_NAMES, POSITIONS, CHAMPIONSHIP_BAR_MULT, INJURY_CHANCE, FANBASE_TYPES, MARKETS, PLAYER_AGE_MAX, COACH_AGE_MAX } from './constants';
import { shuffle, weightedPick } from './rng';
import { makeCard, randomArch, cardTotal, neededPosition, drawCoachCard, applyCoachRetention, drawMatchupModifierCard } from './cards';
import { finalizeCap, rosterSalary } from './economy';
import { autoSelectFive, effectiveRating } from './roster';

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
    },
  };
}

export function buildStarPool(state) {
  state.starPool = [];
  TIERS.forEach((tier) => {
    for (let i = 0; i < tier.count; i++) {
      const posPool = tier.allowedPositions || POSITIONS;
      const pos = posPool[Math.floor(Math.random() * posPool.length)];
      state.starPool.push(makeCard(state, randomArch(), pos, tier));
    }
  });
  shuffle(state.starPool);
}

// teamSeats: array of { name, human, ownerUid } — seat 0 is always the primary/local seat in solo mode.
export function buildTeams(state, teamSeats) {
  state.teams = teamSeats.map((seat) => ({
    name: seat.name,
    human: seat.human,
    ownerUid: seat.ownerUid ?? null,
    hand: [],
    titles: 0,
    playoffAppearances: 0,
    lastOverage: 0,
    retainedStreak: 0,
    lastCoachName: null,
    matchupCard: null,
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
    for (let i = 0; i < count; i++) { team.hand.push(state.starPool.pop()); }
  });
  state.teams.forEach((team) => {
    while (team.hand.length < 9) {
      team.hand.push(makeCard(state, randomArch(), neededPosition(team) || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
    }
  });
}

export function refreshAdvantage(team) {
  team.advantageAvailable = !!(team.fanbase && team.fanbase.name === 'Die Hard');
}

// Runs once, right after team setup and before hands are dealt. Coach, Fanbase, and Market are
// pulled here for AI teams and kept for the whole era. Human teams pull their own via pullCoach etc.
export function initFrontOffice(state) {
  state.phase = 'pullcards';
  state.bar = undefined;
  state.leagueAvg = undefined;
  state.teams.forEach((team) => {
    if (!team.human) {
      team.coach = drawCoachCard();
      applyCoachRetention(team, team.coach);
      team.fanbase = weightedPick(FANBASE_TYPES);
      team.attendance = team.fanbase.attendanceBase;
      refreshAdvantage(team);
      team.market = weightedPick(MARKETS);
      finalizeCap(team, state.season);
    } else {
      team.coach = null;
      team.fanbase = null;
      team.attendance = 0.5;
      team.advantageAvailable = false;
      team.market = null;
      team.seasonCap = undefined;
    }
  });
}

export function initSeasonModifierCards(state) {
  state.phase = 'pullmodifier';
  state.bar = undefined;
  state.leagueAvg = undefined;
  state.teams.forEach((team) => {
    team.matchupCard = team.human ? null : drawMatchupModifierCard();
  });
}

// Runs at the start of every season after the first. Cards are already kept — this just refreshes
// season-scoped state (cap recompute, coach retention streak, Die Hard's once-per-season ability).
export function startNewSeasonRoster(state) {
  state.teams.forEach((team) => {
    applyCoachRetention(team, team.coach);
    refreshAdvantage(team);
    finalizeCap(team, state.season);
    team.activeIds = autoSelectFive(team.hand);
    team.coach.age = Math.min(COACH_AGE_MAX, team.coach.age + 1);
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
  });

  const seeds = state.teams
    .map((t) => {
      let val = effectiveRating(t) * (0.9 + Math.random() * 0.2);
      if (t.matchupCard && t.matchupCard.name === 'Favorable Schedule') { val *= 1.10; }
      return { t, val };
    })
    .sort((a, b) => b.val - a.val);
  seeds.forEach((s, rank) => { s.t.seed = rank + 1; });
  state.seeds = seeds;
  state.playoffTeams = seeds.slice(0, 8).map((s) => s.t);
  state.playoffTeams.forEach((t) => { t.playoffAppearances = (t.playoffAppearances || 0) + 1; });
  // Championship bar is set from the playoff field only — teams that missed the cut don't
  // drag the bar down (or up) for the teams that actually have a shot at the title.
  state.leagueAvg = state.playoffTeams.reduce((s, t) => s + effectiveRating(t), 0) / state.playoffTeams.length;
  state.barMult = (state.settings && state.settings.championshipBarMult) || CHAMPIONSHIP_BAR_MULT;
  state.bar = state.leagueAvg * state.barMult;
  state.phase = 'standings';
}

export function startPlayoffs(state) {
  state.phase = 'playoffs';
  state.playoff = {
    stage: 0,
    useAdvantage: false,
    useCard: false,
    useInjuryPrevention: false,
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

export function updateAttendanceAndFanbase(state) {
  state.teams.forEach((team) => { team.lastSeasonAvgScore = seasonAvgScoreForTeam(state, team); });
  const leagueAvgScore = state.teams.reduce((s, t) => s + t.lastSeasonAvgScore, 0) / state.teams.length;
  state.teams.forEach((team) => {
    const delta = (team.lastSeasonAvgScore - leagueAvgScore) * 0.01;
    team.attendance = Math.max(0, Math.min(1, (team.attendance !== undefined ? team.attendance : 0.5) + delta));
    if (team.fanbase.name === 'Die Hard' && team.lastSeasonAvgScore < leagueAvgScore) {
      team.fanbase = FANBASE_TYPES.find((f) => f.name === 'Invested');
    }
  });
}

export function finishPlayoffs(state) {
  const winner = state.playoff.matches[state.playoff.matches.length - 1].result.winner;
  const winnerRating = effectiveRating(winner);
  const champion = winnerRating >= state.bar ? winner : null;
  if (champion) champion.titles++;

  state.lastResult = { seeds: state.seeds, matches: state.playoff.matches, winner, leagueAvg: state.leagueAvg, bar: state.bar, barMult: state.barMult, champion };
  state.log.push({ season: state.season, champion: champion ? champion.name : null, bar: Math.round(state.bar), winner: winner.name });
  state.phase = 'results';
}

export function proceedFromResults(state) {
  updateAttendanceAndFanbase(state);
  state.lastExpiredPlayers = [];
  state.teams.forEach((team) => {
    const kept = [];
    team.hand.forEach((c) => {
      c.contract--;
      c.age = Math.min(PLAYER_AGE_MAX, c.age + 1);
      if (c.contract <= 0) {
        state.freeAgents.push(Object.assign({}, c, { contract: c.maxContract }));
        if (team.human) state.lastExpiredPlayers.push(c);
      } else kept.push(c);
    });
    team.hand = kept;
  });
  state.phase = 'freeagency';
}

export function signFreeAgent(state, cardId, teamIdx) {
  const idx = state.freeAgents.findIndex((c) => c.id === cardId);
  if (idx < 0) return { ok: false, msg: 'Card not available.' };
  const team = state.teams[teamIdx];
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  const [card] = state.freeAgents.splice(idx, 1);
  team.hand.push(card);
  return { ok: true };
}

export function signReplacement(state, teamIdx) {
  const team = state.teams[teamIdx];
  if (team.hand.length >= 9) return { ok: false, msg: 'Your roster is full.' };
  team.hand.push(makeCard(state, randomArch(), neededPosition(team) || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
  return { ok: true };
}

export function finishFreeAgency(state) {
  state.teams.slice(1).forEach((team) => {
    while (team.hand.length < 9) {
      const need = neededPosition(team);
      const poolMatch = need ? state.freeAgents.find((c) => c.position === need) : null;
      if (poolMatch) {
        team.hand.push(state.freeAgents.splice(state.freeAgents.indexOf(poolMatch), 1)[0]);
      } else if (state.freeAgents.length > 0 && !need) {
        let bestIdx = 0, bestVal = -1;
        state.freeAgents.forEach((c, i) => { const v = cardTotal(c); if (v > bestVal) { bestVal = v; bestIdx = i; } });
        const [card] = state.freeAgents.splice(bestIdx, 1);
        team.hand.push(card);
      } else {
        team.hand.push(makeCard(state, randomArch(), need || POSITIONS[Math.floor(Math.random() * 3)], REPLACEMENT_TIER));
      }
    }
  });
  state.season++;
  if (state.season > 8) { state.phase = 'era_end'; }
  else { startNewSeasonRoster(state); }
}
