import { applySupplementalCard, supplementalRoll } from './supplementalEffects';
// Nine Deep's turn-by-turn playoff match engine — a coin flip decides who opens on offense.
// A match is exactly two possessions ("exchanges"): the coin-flip winner is offense for
// Exchange 1, the loser is offense for Exchange 2, so both teams get exactly one offense roll
// and one defense roll, same total dice as the old three-roll-per-team model. Within an
// exchange, offense chooses a matchup card (or passes), then defense does — each blind to the
// other's pick — before either die is rolled. Both then roll: if offense's die ties or beats
// defense's, offense's full total counts; if defense's die is higher, offense's total is cut by
// the defending team's coach.defBonus (a stronger defensive coach costs the offense more).
// Defense's total always counts, win or lose. Bench, Home Court, matchup-card effects, and
// Advantage/Disadvantage all work exactly as before — only how the offense/defense numbers get
// produced, and who rolls against whom, has changed.
import { HOME_COURT_BONUS } from './constants';
import { rollDie } from './rng';
import { offenseDieSize, defenseDieSize } from './roster';
import {
  checkInjury, playCardEffect, playableCards,
  benchScore, hasHomeCourt, applyLiveFanbaseMod, wantsAdvantage,
} from './matchup';
import { applyPlayoffWinMilestone } from './fanbase';
import { applyGameplanToTurn } from './strategyCards';

export const EXCHANGE_PLAN = [
  { offenseWho: 'first', defenseWho: 'second' },
  { offenseWho: 'second', defenseWho: 'first' },
];

function pushLog(turn, tag, text) {
  turn.log.unshift({ tag, text, stepIndex: turn.exchangeIndex });
}

export function beginTurn(state) {
  const m = state.playoff.matches[state.playoff.activeMatchIndex];
  if (!m || m.result || m.turn) return;
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

  m.turn = {
    stage: 'coinflip',
    exchangeIndex: 0,
    order: null,
    current: null,
    offenseSide: null,
    defenseSide: null,
    advA, advB, injA, injB, idsA, idsB, extraA, extraB, cardNotes, hcaA, hcaB,
    boardActions: [],
    log: [],
  };
  for (const [side, team] of [['a', m.a], ['b', m.b]]) {
    if (team.human) continue;
    for (const card of team.gameplanCards || []) {
      if (card.used || !card.contexts?.includes('playoff')) continue;
      applyGameplanToTurn(m.turn, side, card);
      card.used = true;
      card.playedContext = 'playoff';
      card.targetTeamId = card.target === 'opponent' ? (side === 'a' ? m.b.id : m.a.id) : team.id;
    }
  }
}

function flipCoin(m) {
  const turn = m.turn;
  const firstIsA = Math.random() < 0.5;
  turn.order = firstIsA ? [m.a, m.b] : [m.b, m.a];
  turn.coinFace = firstIsA ? 'HEADS' : 'TAILS'; // cosmetic only — a fixed function of who's first
  pushLog(turn, 'pregame', `Coin flip — ${turn.order[0].name} starts on offense.`);
  turn.stage = 'coinflipped';
}

function startExchange(m) {
  const turn = m.turn;
  const plan = EXCHANGE_PLAN[turn.exchangeIndex];
  const offenseTeam = plan.offenseWho === 'first' ? turn.order[0] : turn.order[1];
  const defenseTeam = offenseTeam === m.a ? m.b : m.a;
  turn.offenseSide = offenseTeam === m.a ? 'a' : 'b';
  turn.defenseSide = defenseTeam === m.a ? 'a' : 'b';
  turn.current = { team: turn.offenseSide, role: 'offense' };
  turn.stage = 'card';
  pushLog(turn, 'pregame', `Exchange ${turn.exchangeIndex + 1}: ${offenseTeam.name} on offense, ${defenseTeam.name} on defense.`);
}

function aiChooseCard(team) {
  const options = playableCards(team);
  return options.length ? options[0] : null;
}

function applyCard(state, m, side, role, card, targetId, stat) {
  const turn = m.turn;
  const actingTeam = side === 'a' ? m.a : m.b;
  if (!card) { pushLog(turn, 'action', `${actingTeam.name} passes.`); return; }
  turn.boardActions ||= [];
  turn.boardActions.push({
    teamName: actingTeam.name,
    cardName: card.name,
    description: card.description || '',
    // Keep a snapshot for the shared match-board reveal. The action log fields above remain
    // for backwards compatibility with matches saved before cards were drawn on the board.
    card: { ...card },
    stepIndex: turn.exchangeIndex,
  });
  const otherSide = side === 'a' ? 'b' : 'a';
  const otherTeam = otherSide === 'a' ? m.a : m.b;
  const actingExtra = side === 'a' ? turn.extraA : turn.extraB;
  const otherExtra = otherSide === 'a' ? turn.extraA : turn.extraB;

  if (card.effectType) {
    const note = applySupplementalCard(state, actingTeam, otherTeam, card, actingExtra, otherExtra,
      side === 'a' ? turn.idsA : turn.idsB, otherSide === 'a' ? turn.idsA : turn.idsB,
      targetId, stat || (role === 'defense' ? 'DEF' : 'SCO'), role);
    if (note) { turn.cardNotes.push({ text: note, cardName: card.name }); pushLog(turn, 'action', note); }
  } else {
    const otherIds = otherSide === 'a' ? turn.idsA : turn.idsB;
    const res = playCardEffect(actingTeam, otherTeam, otherIds, state.playoff, card, targetId);
    if (otherSide === 'a') turn.idsA = res.targetIds; else turn.idsB = res.targetIds;
    actingExtra.offDelta += res.userOffDelta; actingExtra.defDelta += res.userDefDelta; actingExtra.leagueMod += res.userLeagueMod;
    otherExtra.offDelta += res.targetOffDelta; otherExtra.defDelta += res.targetDefDelta;
    if (res.note) turn.cardNotes.push({ text: res.note, cardName: res.cardName });
    pushLog(turn, 'action', `${actingTeam.name} plays ${card.name}.`);
  }
}

function resolveExchange(state, m) {
  const turn = m.turn;
  const offSide = turn.offenseSide, defSide = turn.defenseSide;
  const offenseTeam = offSide === 'a' ? m.a : m.b;
  const defenseTeam = defSide === 'a' ? m.a : m.b;
  const offenseExtra = offSide === 'a' ? turn.extraA : turn.extraB;
  const defenseExtra = defSide === 'a' ? turn.extraA : turn.extraB;
  const offenseIds = offSide === 'a' ? turn.idsA : turn.idsB;
  const defenseIds = defSide === 'a' ? turn.idsA : turn.idsB;
  const offAdv = offSide === 'a' ? turn.advA : turn.advB;
  const defAdv = defSide === 'a' ? turn.advA : turn.advB;

  const offSides = offenseDieSize(offenseTeam);
  const defSidesN = defenseDieSize(defenseTeam);
  const offRolled = supplementalRoll(offenseTeam, offenseIds, offenseExtra, 'offense', rollDie(offSides), rollDie(offSides), offAdv);
  const defRolled = supplementalRoll(defenseTeam, defenseIds, defenseExtra, 'defense', rollDie(defSidesN), rollDie(defSidesN), defAdv);

  const offenseWon = offRolled.die >= defRolled.die;
  // The haircut draws on the same bonus stack that built the defense's own modifier — coach
  // bonus, roster chemistry, and skillset synergy — so a defense that's actually elite (not
  // just coached well) suppresses the offense more, same as it banks more on its own side.
  const db = defRolled.breakdown;
  const haircut = db.coachBonus + db.retention + db.relationship + db.handsOff + (db.synergyPct || 0) / 100;
  const offenseOutput = offenseWon ? offRolled.total : Math.round(offRolled.total * (1 - haircut) * 100) / 100;
  const defenseOutput = defRolled.total;

  turn[`${offSide}OffDie`] = offRolled.die; turn[`${offSide}OffDieOther`] = offRolled.dieOther; turn[`${offSide}OffMode`] = offRolled.mode;
  turn[`${offSide}OffMod`] = offRolled.mod; turn[`${offSide}OffTotal`] = offenseOutput; turn[`${offSide}OffSides`] = offSides;
  turn[`${offSide}OffWon`] = offenseWon; turn[`${offSide}OffBreakdown`] = offRolled.breakdown;
  turn[`${offSide}OffRaw`] = offRolled.total; turn[`${offSide}Haircut`] = offenseWon ? 0 : haircut;
  turn[`${defSide}DefDie`] = defRolled.die; turn[`${defSide}DefDieOther`] = defRolled.dieOther; turn[`${defSide}DefMode`] = defRolled.mode;
  turn[`${defSide}DefMod`] = defRolled.mod; turn[`${defSide}DefTotal`] = defenseOutput; turn[`${defSide}DefSides`] = defSidesN;
  turn[`${defSide}DefBreakdown`] = defRolled.breakdown;

  // Keep each die and the possession outcome as separate log events. The values are resolved
  // atomically here, while TurnPanel reveals these entries one at a time as each on-screen die
  // lands. This also gives completed and serialized matches a faithful roll-by-roll history.
  pushLog(turn, 'roll-offense', `${offenseTeam.name} rolls ${offRolled.die} (1d${offSides}) on Offense.`);
  pushLog(turn, 'roll-defense', `${defenseTeam.name} rolls ${defRolled.die} (1d${defSidesN}) on Defense.`);
  pushLog(turn, 'resolution',
    (offenseWon
      ? `Offense wins the possession — ${offenseTeam.name} banks the full ${offenseOutput}.`
      : `Defense wins the possession — ${offenseTeam.name}'s offense is cut from ${offRolled.total} to ${offenseOutput} (${Math.round(haircut * 100)}% haircut from ${defenseTeam.name}'s coaching, chemistry, and synergy).`) +
    ` ${defenseTeam.name}'s defense banks ${defenseOutput} regardless.`);

  turn.current = null;
  turn.stage = 'resolved';
}

function computeBench(m) {
  const turn = m.turn;
  const aBench = benchScore(m.a, turn.idsA, false) + (turn.extraA.benchBonus || 0);
  const bBench = benchScore(m.b, turn.idsB, false) + (turn.extraB.benchBonus || 0);
  turn.aBench = aBench; turn.bBench = bBench;
  pushLog(turn, 'bench', `${m.a.name}'s bench contributes +${aBench}.`);
  pushLog(turn, 'bench', `${m.b.name}'s bench contributes +${bBench}.`);
  turn.current = null;
  turn.stage = 'bench';
}

function finishTurn(state, m) {
  const turn = m.turn;
  // Round the sum too, not just its inputs — see matchup.js's playMatchup for why (several
  // already-rounded floats can still add up to something like 22.06000000000002).
  const aSum = Math.round((turn.aOffTotal + turn.aDefTotal + turn.aBench + turn.extraA.leagueMod) * 100) / 100;
  const bSum = Math.round((turn.bOffTotal + turn.bDefTotal + turn.bBench + turn.extraB.leagueMod) * 100) / 100;
  const winner = aSum === bSum ? (Math.random() < 0.5 ? m.a : m.b) : aSum > bSum ? m.a : m.b;
  m.result = {
    a: m.a, b: m.b, advA: !!turn.advA, advB: !!turn.advB,
    aOffDie: turn.aOffDie, aOffMod: turn.aOffMod, aOffTotal: turn.aOffTotal, aOffSides: turn.aOffSides, aOffWon: turn.aOffWon,
    aDefDie: turn.aDefDie, aDefMod: turn.aDefMod, aDefTotal: turn.aDefTotal, aDefSides: turn.aDefSides,
    aBench: turn.aBench, aLeagueMod: turn.extraA.leagueMod, aSum,
    bOffDie: turn.bOffDie, bOffMod: turn.bOffMod, bOffTotal: turn.bOffTotal, bOffSides: turn.bOffSides, bOffWon: turn.bOffWon,
    bDefDie: turn.bDefDie, bDefMod: turn.bDefMod, bDefTotal: turn.bDefTotal, bDefSides: turn.bDefSides,
    bBench: turn.bBench, bLeagueMod: turn.extraB.leagueMod, bSum,
    winner,
    injA: turn.injA, injB: turn.injB, cardNotes: turn.cardNotes,
    aExtra: turn.extraA, bExtra: turn.extraB, hcaA: turn.hcaA, hcaB: turn.hcaB,
    turnLog: turn.log,
  };
  applyPlayoffWinMilestone(winner);
  state.playoff.cardChoices ||= {};
  state.playoff.cardChoices[m.a.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
  state.playoff.cardChoices[m.b.id] = { useAdvantage: false, selectedCardId: null, selectedTargetId: null, useInjuryPrevention: false };
  turn.stage = 'complete';
}

export function advanceTurn(state, payload) {
  const m = state.playoff.matches[state.playoff.activeMatchIndex];
  const turn = m.turn;
  if (!turn || turn.stage === 'complete') return;

  if (turn.stage === 'coinflip') { flipCoin(m); return; }
  if (turn.stage === 'coinflipped') { startExchange(m); return; }

  if (turn.stage === 'card') {
    const cur = turn.current;
    const actingTeam = cur.team === 'a' ? m.a : m.b;
    let card = null, targetId = null, stat = null;
    if (actingTeam.human) {
      if (payload && !payload.pass) {
        const options = playableCards(actingTeam);
        card = options.find((c) => c.id === payload.cardId) || null;
        targetId = card ? payload.targetId || null : null;
        stat = card ? payload.stat || null : null;
      }
    } else {
      card = aiChooseCard(actingTeam);
    }
    applyCard(state, m, cur.team, cur.role, card, targetId, stat);

    if (cur.role === 'offense') {
      turn.current = { team: turn.defenseSide, role: 'defense' };
    } else {
      resolveExchange(state, m);
    }
    return;
  }

  if (turn.stage === 'resolved') {
    if (turn.exchangeIndex === 0) {
      turn.exchangeIndex = 1;
      startExchange(m);
    } else {
      computeBench(m);
    }
    return;
  }

  if (turn.stage === 'bench') { finishTurn(state, m); }
}
