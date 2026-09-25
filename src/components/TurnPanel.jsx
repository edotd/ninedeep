import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { offenseDieSize, defenseDieSize } from '../game/roster';
import { playableCards } from '../game/matchup';
import { eligibleStatTargets, PLAYER_STATS } from '../game/supplementalEffects';
import Die, { ROLL_DURATION_MS } from './Die';
import BallMark from './BallMark';
import CompactPlayerTile from './CompactPlayerTile';
import CompactCoachCard from './CompactCoachCard';
import MatchupCard from './MatchupCard';
import CardTypeMark from './CardTypeMark';

// Decision clock for a blind matchup-card choice — long enough to read your hand, short
// enough to put real pressure on the pick. Auto-passes on timeout so a stalled player can't
// freeze the match for their opponent.
const CARD_TIMER_SECONDS = 12;

// How long the coin spins before the flip actually resolves, and how long the result reads
// on screen before auto-advancing into the first card window — both purely presentational
// delays around the instant, synchronous advanceTurn() call.
const COIN_SPIN_MS = 800;
const COIN_RESULT_MS = 750;

// The engine resolves both of an exchange's dice in one atomic step, but the roll zone plays
// them back as a little sequence a click at a time — offense's die sits at rest until Roll is
// clicked, spins for ROLL_DURATION_MS and reveals, then after a read pause defense's die does
// the same. The first exchange pauses for a Start Next Possession click; the second continues
// to the bench. All timing is presentational around already-final resolved numbers.
const ROLL_REVEAL_MS = 400;
const ROLL_BOTH_READ_MS = 900;
const ADJUSTMENT_REVEAL_MS = 1600;

// The possession report reveals in three beats rather than all at once: the winner line sits
// alone for REPORT_BEAT_MS, then Offense fades in and tallies up to its total over
// REPORT_COUNT_MS, then after REPORT_HALF_BEAT_MS Defense does the same — mirroring the
// "arrow settles, then each side's number builds" read a real box score gets.
const REPORT_BEAT_MS = 800;
const REPORT_COUNT_MS = 350;
const REPORT_HALF_BEAT_MS = 150;

// Rounds a mid-tally value to 2 decimals and drops trailing zeros, so the count-up reads
// cleanly frame to frame (no floating-point noise) and lands on exactly the same string the
// static "+N" display always used (whole totals print as "10", not "10.00").
function formatTally(n) { return Number(n.toFixed(2)).toString(); }

// Animates 0 -> target over durationMs via rAF while `running` is true, and resets to 0 the
// moment it goes false — used so each report row's number visibly builds up rather than just
// appearing, and starts fresh again on the next possession.
function useCountUp(target, durationMs, running) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) { setValue(0); return undefined; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, target, durationMs]);
  return running ? value : 0;
}

// The bench stage reveals the same way: the coin-toss winner's bench figure first, a read
// pause, then the other team's, then a final read pause before the result card appears.
const BENCH_REVEAL_MS = 700;
const BENCH_RESULT_MS = 700;

// A few phrasings per margin band so the final-result card doesn't read the same way every
// turn — picked once when the result actually appears, not re-rolled on every render.
const NAIL_BITER_BLURBS = [
  '{w} escapes in a nail-biter, {d} points to spare.',
  '{w} survives a dogfight with {l}, winning by just {d}.',
  'Down to the wire — {w} holds on by {d}.',
];
const COMFORTABLE_BLURBS = [
  '{w} pulls away for a comfortable win.',
  '{w} controls it from the front, {d} points clear of {l}.',
  '{w} closes it out cleanly over {l}.',
];
const BLOWOUT_BLURBS = [
  '{w} blows the doors off, winning by {d}.',
  '{w} runs away with it in a blowout.',
  '{w} dominates {l} from wire to wire.',
];

function matchBlurb(winnerName, loserName, diff) {
  const pool = diff <= 3 ? NAIL_BITER_BLURBS : diff <= 10 ? COMFORTABLE_BLURBS : BLOWOUT_BLURBS;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick.replace('{w}', winnerName).replace('{l}', loserName).replace('{d}', diff.toFixed(1));
}

function chipSlots(cards, count) {
  return Array.from({ length: count }, (_, i) => cards[i] || null);
}

// Whether the game log starts collapsed — remembered for the session (sessionStorage, not
// localStorage) so it holds across matches and reloads in this tab but doesn't leak into a
// fresh session.
const LOG_COLLAPSED_KEY = 'nd_log_collapsed';
function readLogCollapsed() {
  try { return sessionStorage.getItem(LOG_COLLAPSED_KEY) === '1'; } catch { return false; }
}

// Whether the post-roll report (after each exchange resolves) advances on its own instead of
// waiting on a click — same session-only persistence as the log-collapsed setting.
const AUTO_PROGRESS_KEY = 'nd_auto_progress';
function readAutoProgress() {
  try { return sessionStorage.getItem(AUTO_PROGRESS_KEY) === '1'; } catch { return false; }
}

// All nine rotation tiles remain visible. The coach gets a dedicated dock beside the team
// name: below the home roster on the left, and above the away roster on the right. Gameplan
// and Adjustment sit together on the side opposite the coach. Both always render, even with
// nothing played yet, so the slot (and whether it is actionable) remains visible.
function TeamBoard({ team, ids, hca, statusLabel, roleLabel, cardPlays, gameplanPlays, gameplanCanPlay, adjustmentCanPlay, onAdjustmentSlotClick, isActive, flip, contributing, timerPercent, benchContribution }) {
  const hand = team.hand || [];
  const activeIds = ids || team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const edge = flip ? 'top' : 'bottom';
  const hasGameplan = gameplanPlays?.length > 0;
  const hasAdjustment = cardPlays?.length > 0;
  return (
    <div className={'t2-teamboard' + (isActive ? ' active' : '') + (flip ? ' flip' : '')}>
      <div className={'nd2-roster' + (timerPercent !== null && timerPercent !== undefined ? ' timer-active' : '')}>
        {timerPercent !== null && timerPercent !== undefined && <div className={'nd2-roster-timer' + (timerPercent <= 25 ? ' urgent' : '')} style={{ width: `${timerPercent}%` }} />}
        {chipSlots(starters, 5).map((c, i) => (c ? <CompactPlayerTile key={`s${i}`} card={c} isStarter edge={edge} contributing={contributing} /> : <div key={`s${i}`} className="nd2-tile empty" />))}
        {chipSlots(bench, 4).map((c, i) => (c ? <CompactPlayerTile key={`b${i}`} card={c} edge={edge} /> : <div key={`b${i}`} className="nd2-tile empty" />))}
      </div>
      <div className="t2-teamboard-meta">
        {team.coach && <div className="t2-coach-dock">
          <div className="nd2-coach-slot"><CompactCoachCard team={team} edge={edge} /></div>
        </div>}
        <div className="t2-card-docks">
          <div className="t2-gameplan-dock">
            {hasGameplan
              ? gameplanPlays.map((entry, i) => (
                <div className="t2-gameplan-mini" key={`${entry.teamName}-${entry.cardName}-${i}`} title={entry.card ? `${entry.card.name} — ${entry.description}` : entry.cardName}>
                  <CardTypeMark type="gameplan" size={60} />
                </div>
              ))
              : (
                <div className={'t2-gameplan-mini empty' + (gameplanCanPlay ? ' pulsing' : '')} aria-hidden="true">
                  <CardTypeMark type="gameplan" size={42} />
                  <span className="t2-mini-plus">+</span>
                </div>
              )}
          </div>
          <div className="t2-adjustment-dock">
            {hasAdjustment
              ? cardPlays.map((entry, i) => (
                <div className="t2-adjustment-mini" key={`${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`} title={entry.card ? `${entry.card.name} — ${entry.description}` : entry.cardName}>
                  <CardTypeMark type="adjustment" size={48} />
                </div>
              ))
              : (
                <button
                  type="button"
                  className={'t2-adjustment-mini empty' + (adjustmentCanPlay ? ' pulsing' : '')}
                  onClick={adjustmentCanPlay ? onAdjustmentSlotClick : undefined}
                  disabled={!adjustmentCanPlay}
                  aria-label={adjustmentCanPlay ? 'Play an Adjustment card' : undefined}
                  aria-hidden={!adjustmentCanPlay}
                >
                  <CardTypeMark type="adjustment" size={36} />
                  <span className="t2-mini-plus">+</span>
                </button>
              )}
          </div>
        </div>
        <div className="t2-teamboard-name">
          {hca && !flip && <span className="t2-hca-tag">Home Court</span>}
          <div className="t2-teamboard-name-line">
            {roleLabel && <span className={'t2-team-role ' + roleLabel.toLowerCase()}>{roleLabel}</span>}
            <div className="t2-teamboard-name-text">{team.name}</div>
          </div>
          {statusLabel && <div className="t2-teamboard-status">{statusLabel}</div>}
          {benchContribution !== null && benchContribution !== undefined && <div className="t2-teamboard-bench">Bench Contribution <strong>+{benchContribution}</strong></div>}
        </div>
      </div>
    </div>
  );
}

// Drives one turn (coin flip, then two offense/defense exchanges, then bench) stage by stage —
// see game/turn.js for the state machine this renders. Stays mounted until m.turn.stage
// becomes 'complete', at which point m.result exists and PlayoffSeriesScreen swaps back to
// the existing MatchupBox reveal. Laid out per the "Nine Deep Match Flow" design's 5A match
// board: a center board with both teams' full rosters/front offices/matchup cards persisting
// above and below one shared roll circle, and a game log — collapsing to one column below the
// desktop breakpoint.
export default function TurnPanel({ state, actions, m, myTeamId, onBack }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  // m.a/m.b can represent home/away (or bracket seeding) rather than "which side the viewer is
  // on" — with the board always rendering teamA on top, a human's own team could land on top in
  // one match and bottom in the next, reading as the two teams randomly swapping sides. Pin the
  // viewer's own team to a fixed side (bottom, the flip slot) whenever they're actually playing;
  // a spectated AI-vs-AI match keeps the original a/b order, which is stable for that match too.
  const topSide = humanInMatch && teamA === myTeam ? 'b' : 'a';
  const bottomSide = topSide === 'a' ? 'b' : 'a';
  const isDesktop = useIsDesktop();
  const dieSize = isDesktop ? 96 : 58;
  const coinSize = isDesktop ? 100 : 64;
  const [timeLeft, setTimeLeft] = useState(CARD_TIMER_SECONDS);
  const [adjustmentPickerOpen, setAdjustmentPickerOpen] = useState(false);
  const [coinSpinning, setCoinSpinning] = useState(false);
  const coinTimerRef = useRef(null);
  // 'idle-off' | 'rolling-off' | 'revealed-off' | 'idle-def' | 'rolling-def' | 'revealed-def' | 'both'
  const [rollPhase, setRollPhase] = useState('idle-off');
  const rollTimerRef = useRef(null);
  // The possession report's own staged reveal once rollPhase reaches 'both': 'winner' (just the
  // winner line) -> 'offense' (offense row tallying up) -> 'defense' (defense row tallying up)
  // -> 'done' (footer/auto-progress controls appear). Driven by the effect below, not clicks.
  const [reportStage, setReportStage] = useState('winner');
  const reportTimersRef = useRef([]);
  // useCountUp is a hook, so it has to run unconditionally at the top level every render —
  // renderRollCircle below is only a plain helper (not itself a component), and it early-returns
  // for every turn.stage other than 'resolved', so hooks can't live inside it. The 0-fallbacks
  // keep the targets valid before there's a real total to count up to; `running` (not the target)
  // is what actually gates whether either one is animating at all.
  const reportOffTotal = turn.stage === 'resolved' ? turn[`${turn.offenseSide}OffTotal`] : 0;
  const reportDefTotal = turn.stage === 'resolved' ? turn[`${turn.defenseSide}DefTotal`] : 0;
  const offenseCount = useCountUp(reportOffTotal, REPORT_COUNT_MS, ['offense', 'defense', 'done'].includes(reportStage));
  const defenseCount = useCountUp(reportDefTotal, REPORT_COUNT_MS, ['defense', 'done'].includes(reportStage));
  // 'first' | 'second' | 'result' — the bench stage's own reveal sequence, mirroring rollPhase.
  const [benchPhase, setBenchPhase] = useState('first');
  const benchTimerRef = useRef(null);
  const [resultBlurb, setResultBlurb] = useState('');
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  // Which side's mod-breakdown popover is open, if any — 'off' | 'def' | null. Reset whenever
  // the exchange or stage moves on, so it never lingers open over stale numbers.
  const [breakdownOpen, setBreakdownOpen] = useState(null);
  useEffect(() => { setBreakdownOpen(null); }, [turn.stage, turn.exchangeIndex]);
  const [logCollapsed, setLogCollapsed] = useState(() => !window.matchMedia('(min-width: 900px)').matches || readLogCollapsed());
  const toggleLogCollapsed = () => {
    setLogCollapsed((v) => {
      const next = !v;
      try { sessionStorage.setItem(LOG_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  const [autoProgress, setAutoProgress] = useState(readAutoProgress);
  const toggleAutoProgress = (checked) => {
    setAutoProgress(checked);
    try { sessionStorage.setItem(AUTO_PROGRESS_KEY, checked ? '1' : '0'); } catch { /* ignore */ }
  };

  const cur = turn.current;
  const actingTeam = cur ? (cur.team === 'a' ? teamA : teamB) : null;
  const offenseTeam = turn.offenseSide ? (turn.offenseSide === 'a' ? teamA : teamB) : null;
  const defenseTeam = turn.defenseSide ? (turn.defenseSide === 'a' ? teamA : teamB) : null;
  // Possession is decided the instant the coin lands (turn.order[0]) — offenseSide isn't set
  // until startExchange runs one stage later, so the header/result badge fall back to the
  // coin-flip winner directly instead of showing blank between 'coinflipped' and 'card'.
  const possessionTeam = offenseTeam || (turn.order ? turn.order[0] : null);

  const myTurnToAct = turn.stage === 'card' && humanInMatch && actingTeam === myTeam;
  // Only a live human opponent (online play) has nothing to prompt here — a wait message is
  // all that's shown, since only that person's own client can submit their pick.
  const waitingOnOpponent = turn.stage === 'card' && humanInMatch && actingTeam !== myTeam && actingTeam.human;
  const aiCardTurn = turn.stage === 'card' && actingTeam && !actingTeam.human;
  const visibleBoardActions = (turn.boardActions || []).filter((entry) => (
    entry.stepIndex === turn.exchangeIndex && (turn.stage === 'resolved' || turn.stage === 'bench')
  ));
  const boardActionSignature = visibleBoardActions.map((entry, i) => (
    `${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`
  )).join('|');
  const [settledActionSignature, setSettledActionSignature] = useState('');
  useEffect(() => {
    if (!boardActionSignature) {
      setSettledActionSignature('');
      return undefined;
    }
    const timer = setTimeout(() => setSettledActionSignature(boardActionSignature), ADJUSTMENT_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [boardActionSignature]);
  const revealingAdjustments = Boolean(boardActionSignature && settledActionSignature !== boardActionSignature);

  const advance = (payload) => actions.advanceTurn(payload);
  const availableAdjustments = myTurnToAct ? playableCards(myTeam) : [];
  const adjustmentTargetTeam = selectedAdjustment
    ? (selectedAdjustment.target === 'self' ? myTeam : (myTeam === teamA ? teamB : teamA))
    : null;
  const adjustmentTargetIds = adjustmentTargetTeam
    ? (adjustmentTargetTeam === teamA ? turn.idsA : turn.idsB)
    : [];
  const adjustmentTargets = selectedAdjustment
    ? eligibleStatTargets(adjustmentTargetTeam, adjustmentTargetIds, selectedAdjustment)
    : [];
  const chooseAdjustment = (card) => {
    if (card.targetsPlayer) {
      setSelectedAdjustment(card);
      return;
    }
    setSelectedAdjustment(null);
    advance({ cardId: card.id });
  };

  // An AI-controlled team's card decision needs this client to call advanceTurn() to actually
  // process it, but it should never wait on a click — it submits on its own, same as the coin
  // flip's result and a finished roll auto-advancing.
  useEffect(() => {
    if (!aiCardTurn) return undefined;
    const t = setTimeout(() => advance(), COIN_RESULT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiCardTurn, turn.exchangeIndex, cur?.team, cur?.role]);

  // Clicking the ball mark spins it in place for a beat before the (instant, synchronous)
  // coin flip actually resolves, then the result reads for a moment before auto-advancing
  // into the first card window — no separate Continue click for either step.
  const startCoinFlip = () => {
    if (coinSpinning) return;
    setCoinSpinning(true);
    coinTimerRef.current = setTimeout(() => {
      advance();
      setCoinSpinning(false);
    }, COIN_SPIN_MS);
  };

  useEffect(() => () => clearTimeout(coinTimerRef.current), []);

  useEffect(() => {
    if (turn.stage !== 'coinflipped') return undefined;
    const t = setTimeout(() => advance(), COIN_RESULT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.stage]);

  // Both dice are already resolved the instant turn.stage becomes 'resolved', but nothing
  // rolls on screen until Roll is actually clicked — reset to the offense side's idle (waiting
  // to roll) state whenever a new exchange's result arrives.
  useEffect(() => {
    clearTimeout(rollTimerRef.current);
    if (turn.stage === 'resolved') setRollPhase('idle-off');
  }, [turn.stage, turn.exchangeIndex]);

  useEffect(() => () => clearTimeout(rollTimerRef.current), []);

  // Clicking the die (or the Roll button) while a side is idle starts that side's roll — every
  // other transition (spin finishing, a reveal's read pause elapsing, the final auto-advance)
  // is scheduled centrally below, all keyed off rollPhase itself so there's exactly one place
  // that ever sets rollTimerRef.
  const startRoll = (which) => {
    if (revealingAdjustments || rollPhase !== `idle-${which}`) return;
    setRollPhase(`rolling-${which}`);
  };

  useEffect(() => {
    clearTimeout(rollTimerRef.current);
    if (rollPhase === 'rolling-off') {
      rollTimerRef.current = setTimeout(() => setRollPhase('revealed-off'), ROLL_DURATION_MS);
    } else if (rollPhase === 'revealed-off') {
      rollTimerRef.current = setTimeout(() => setRollPhase('idle-def'), ROLL_REVEAL_MS);
    } else if (rollPhase === 'rolling-def') {
      rollTimerRef.current = setTimeout(() => setRollPhase('revealed-def'), ROLL_DURATION_MS);
    } else if (rollPhase === 'revealed-def') {
      rollTimerRef.current = setTimeout(() => setRollPhase('both'), ROLL_REVEAL_MS);
    } else if (rollPhase === 'both' && autoProgress && reportStage === 'done') {
      // With auto-progress off (the default), both post-roll reports wait on their own
      // "Start Next Possession" / "Start Bench Contribution" click instead of advancing here.
      // Waits for the report's own reveal (see reportStage below) to finish first, so
      // auto-progress never skips past the Offense/Defense tally-up before it's readable.
      rollTimerRef.current = setTimeout(() => advance(), ROLL_BOTH_READ_MS);
    }
    return () => clearTimeout(rollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollPhase, turn.exchangeIndex, autoProgress, reportStage]);

  // Stages the possession report's reveal once both dice have landed: winner line alone, then
  // Offense fades in and tallies, then (after a shorter half-beat) Defense does the same, then
  // 'done' unlocks the footer/auto-progress. Resets back to 'winner' the instant rollPhase
  // leaves 'both' so the next possession's report starts its reveal from scratch too.
  useEffect(() => {
    reportTimersRef.current.forEach(clearTimeout);
    if (rollPhase !== 'both') { setReportStage('winner'); return undefined; }
    setReportStage('winner');
    reportTimersRef.current = [
      setTimeout(() => setReportStage('offense'), REPORT_BEAT_MS),
      setTimeout(() => setReportStage('defense'), REPORT_BEAT_MS + REPORT_COUNT_MS + REPORT_HALF_BEAT_MS),
      setTimeout(() => setReportStage('done'), REPORT_BEAT_MS + REPORT_COUNT_MS + REPORT_HALF_BEAT_MS + REPORT_COUNT_MS),
    ];
    return () => reportTimersRef.current.forEach(clearTimeout);
  }, [rollPhase, turn.exchangeIndex]);

  // Only the side's own controlling human ever clicks its die — an AI-controlled side (or the
  // other real player's side, in online play) never waits on this client's click. AI sides
  // start themselves after a short beat, same idea as the AI card auto-advance above; a human
  // opponent's side just sits idle here until their own client calls startRoll.
  useEffect(() => {
    if (turn.stage !== 'resolved' || revealingAdjustments) return undefined;
    let t;
    if (rollPhase === 'idle-off' && offenseTeam && !offenseTeam.human) t = setTimeout(() => startRoll('off'), 500);
    else if (rollPhase === 'idle-def' && defenseTeam && !defenseTeam.human) t = setTimeout(() => startRoll('def'), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollPhase, turn.stage, revealingAdjustments]);

  // The bench stage reveals the coin-toss winner's contribution, then the other team's, then
  // the final result — both numbers are already final the instant turn.stage becomes 'bench',
  // same as the exchange rolls, this is purely the presentational sequencing.
  useEffect(() => {
    if (turn.stage === 'bench') setBenchPhase('first');
  }, [turn.stage]);

  useEffect(() => {
    clearTimeout(benchTimerRef.current);
    if (turn.stage !== 'bench') return undefined;
    if (benchPhase === 'first') {
      benchTimerRef.current = setTimeout(() => setBenchPhase('second'), BENCH_REVEAL_MS);
    } else if (benchPhase === 'second') {
      benchTimerRef.current = setTimeout(() => setBenchPhase('result'), BENCH_RESULT_MS);
    }
    return () => clearTimeout(benchTimerRef.current);
  }, [benchPhase, turn.stage]);

  useEffect(() => () => clearTimeout(benchTimerRef.current), []);

  // The winner/margin blurb is picked once, right when the result card first appears — not
  // re-rolled on every render, and not shown at all until both bench figures have revealed.
  useEffect(() => {
    if (benchPhase !== 'result' || turn.stage !== 'bench') return;
    const aSum = Math.round((turn.aOffTotal + turn.aDefTotal + turn.aBench + turn.extraA.leagueMod) * 100) / 100;
    const bSum = Math.round((turn.bOffTotal + turn.bDefTotal + turn.bBench + turn.extraB.leagueMod) * 100) / 100;
    const winnerTeam = aSum >= bSum ? teamA : teamB;
    const loserTeam = winnerTeam === teamA ? teamB : teamA;
    setResultBlurb(matchBlurb(winnerTeam.name, loserTeam.name, Math.abs(aSum - bSum)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPhase, turn.stage]);

  // Once the winner announcement has had a moment to read, finalize the turn automatically.
  // The completed result screen owns the only remaining action: Back to Playoff Bracket.
  useEffect(() => {
    if (benchPhase !== 'result' || turn.stage !== 'bench') return undefined;
    const t = setTimeout(() => advance(), BENCH_RESULT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPhase, turn.stage]);

  useEffect(() => {
    if (!myTurnToAct) { setTimeLeft(CARD_TIMER_SECONDS); return undefined; }
    setTimeLeft(CARD_TIMER_SECONDS);
    const start = Date.now();
    const iv = setInterval(() => {
      const remaining = CARD_TIMER_SECONDS - (Date.now() - start) / 1000;
      if (remaining <= 0) {
        clearInterval(iv);
        setTimeLeft(0);
        advance({ pass: true });
      } else {
        setTimeLeft(remaining);
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurnToAct, turn.exchangeIndex, cur?.team, cur?.role]);
  useEffect(() => { if (!myTurnToAct) setSelectedAdjustment(null); }, [myTurnToAct]);
  useEffect(() => { setAdjustmentPickerOpen(false); }, [myTurnToAct, turn.exchangeIndex]);

  // Blind by convention: a card play is logged the instant it's chosen, but withheld from
  // display until its own exchange resolves — otherwise the second team to act (or a
  // spectator watching both) would read the first team's pick before committing their own.
  // Roll values are final in game state before their animations play, so each roll log entry
  // waits for its corresponding die to land. The possession result waits until both are shown.
  // Bench entries follow the same rule and wait for the bench reveal to finish.
  const visibleLog = turn.log.filter((e) => {
    if (e.tag === 'action') return e.stepIndex < turn.exchangeIndex || turn.stage === 'resolved' || turn.stage === 'bench' || turn.stage === 'complete';
    if (e.tag === 'roll-offense' && turn.stage === 'resolved' && e.stepIndex === turn.exchangeIndex) {
      return !['idle-off', 'rolling-off'].includes(rollPhase);
    }
    if (e.tag === 'roll-defense' && turn.stage === 'resolved' && e.stepIndex === turn.exchangeIndex) {
      return ['revealed-def', 'both'].includes(rollPhase);
    }
    if (e.tag === 'resolution') return !(turn.stage === 'resolved' && e.stepIndex === turn.exchangeIndex) || rollPhase === 'both';
    if (e.tag === 'bench') return turn.stage !== 'bench' || benchPhase === 'result';
    return true;
  });
  const gameplanActions = (turn.gameplanNotes || []).map((entry) => ({
    teamName: entry.teamSide === 'a' ? teamA.name : teamB.name,
    cardName: entry.cardName,
    description: entry.description,
    card: entry.card,
    stepIndex: -1,
  }));
  // Each played-card notice draws on the side of the board the team that played it sits on,
  // rather than lumped together in the middle — teamA's play appears above the roll circle
  // (next to teamA's board), teamB's below (next to teamB's).
  const teamACardPlays = visibleBoardActions.filter((entry) => entry.teamName === teamA.name);
  const teamBCardPlays = visibleBoardActions.filter((entry) => entry.teamName === teamB.name);
  const teamAGameplans = gameplanActions.filter((entry) => entry.teamName === teamA.name);
  const teamBGameplans = gameplanActions.filter((entry) => entry.teamName === teamB.name);
  const settledTeamACards = revealingAdjustments ? [] : teamACardPlays;
  const settledTeamBCards = revealingAdjustments ? [] : teamBCardPlays;

  // Board-position lookups, keyed by side ('a'/'b') rather than physical position — topSide/
  // bottomSide (above) decide which side actually renders where.
  const teamOf = (side) => (side === 'a' ? teamA : teamB);
  const idsOf = (side) => (side === 'a' ? turn.idsA : turn.idsB);
  const hcaOf = (side) => (side === 'a' ? turn.hcaA : turn.hcaB);
  const cardsOf = (side) => (side === 'a' ? settledTeamACards : settledTeamBCards);
  const gameplansOf = (side) => (side === 'a' ? teamAGameplans : teamBGameplans);
  const benchOrder = turn.order && turn.order.length === 2 ? turn.order : [teamA, teamB];
  const benchFor = (team) => (team === teamA ? turn.aBench : turn.bBench);
  const benchVisibleFor = (team) => {
    if (turn.stage !== 'bench') return null;
    if (benchPhase === 'first' && team !== benchOrder[0]) return null;
    return benchFor(team);
  };
  const timerFor = (team) => (myTurnToAct && actingTeam === team ? Math.max(0, Math.min(100, (timeLeft / CARD_TIMER_SECONDS) * 100)) : null);
  // Only the viewer's own empty slot ever pulses — you can't play the opponent's cards, so
  // there's nothing actionable to draw their eye to on that side. Gameplan mirrors
  // playGameplanCard's own 'playoff' eligibility window and its one-active-at-a-time rule;
  // Adjustment mirrors the picker's own availableAdjustments during the human's own card turn.
  const gameplanCanPlayFor = (team) => (
    team === myTeam
    && ['coinflip', 'coinflipped'].includes(turn.stage)
    && !(team.gameplanCards || []).some((c) => c.used)
    && (team.gameplanCards || []).some((c) => !c.used && c.contexts.includes('playoff'))
  );
  const adjustmentCanPlayFor = (team) => team === myTeam && myTurnToAct && availableAdjustments.length > 0;

  const statusFor = (side) => {
    const team = side === 'a' ? teamA : teamB;
    if (turn.stage === 'coinflip') return '';
    if (turn.stage === 'bench') return 'Bench · No Cards';
    if (turn.stage === 'resolved') {
      if (offenseTeam === team) {
        return (rollPhase === 'idle-off' || rollPhase === 'rolling-off') ? 'On Offense' : `Offense Roll — ${turn[`${side}OffDie`]}`;
      }
      if (defenseTeam === team) {
        return (rollPhase === 'revealed-def' || rollPhase === 'both') ? `Defense Roll — ${turn[`${side}DefDie`]}` : 'On Defense';
      }
      return '';
    }
    if (offenseTeam === team) return 'On Offense · Cards Face Down Until Played';
    if (defenseTeam === team) return 'On Defense · Cards Face Down Until Played';
    return possessionTeam === team ? 'Won The Tip' : '';
  };
  const roleFor = (team) => {
    if (offenseTeam === team) return 'OFFENSE';
    if (defenseTeam === team) return 'DEFENSE';
    return '';
  };

  // The "why" behind a settled die's mod — stat sum through coach bonus, roster chemistry,
  // skillset synergy, and any card modifier, in the order they're actually applied
  // (roster.js's modifierBreakdown, then supplementalRoll's card layer on top).
  const renderModBreakdown = (team, kind, b) => {
    if (!b) return null;
    const pct = (n) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;
    return (
      <div className="t2-mod-breakdown t2-fade-in">
        <div className="t2-mod-breakdown-head">{team.name} — {kind === 'offense' ? 'Offense' : 'Defense'}</div>
        <div className="t2-mod-row"><span>{kind === 'offense' ? 'SCO + PLM' : 'DEF + REB'}</span><span>{b.statSum}</span></div>
        <div className="t2-mod-row"><span>Coach Bonus</span><span>{pct(b.coachBonus)}</span></div>
        {b.retention !== 0 && <div className="t2-mod-row"><span>Retention</span><span>{pct(b.retention)}</span></div>}
        {b.relationship !== 0 && <div className="t2-mod-row"><span>Relationships</span><span>{pct(b.relationship)}</span></div>}
        {b.handsOff !== 0 && <div className="t2-mod-row"><span>GM Approach</span><span>{pct(b.handsOff)}</span></div>}
        {b.gameplan !== 0 && <div className="t2-mod-row"><span>Gameplan</span><span>{pct(b.gameplan)}</span></div>}
        <div className="t2-mod-row"><span>Roster Base</span><span>{b.preSynergyBase}</span></div>
        {b.synergyPct !== 0 && <div className="t2-mod-row"><span>Skillset Synergy</span><span>{b.synergyPct >= 0 ? '+' : ''}{b.synergyPct}%</span></div>}
        <div className="t2-mod-row t2-mod-subtotal"><span>Roster Mod</span><span>{b.base}</span></div>
        {b.cardPercent !== 0 && <div className="t2-mod-row t2-mod-card"><span>Card Modifier</span><span>{b.cardPercent >= 0 ? '+' : ''}{b.cardPercent}%</span></div>}
        {b.cardDelta !== 0 && <div className="t2-mod-row t2-mod-card"><span>Card Modifier</span><span>{b.cardDelta >= 0 ? '+' : ''}{b.cardDelta}</span></div>}
        <div className="t2-mod-row t2-mod-total"><span>Final Mod</span><span>{b.mod}</span></div>
      </div>
    );
  };

  // The roll-zone circle: the coin before/at the flip, then each exchange's two dice once
  // rolled — the same circle is reused for every roll in the match, per the design's "clean
  // look" note ("every roll of the match resolves in this circle").
  const renderRollCircle = () => {
    if (turn.stage === 'coinflip' || turn.stage === 'coinflipped') {
      if (!turn.order) {
        return (
          <div className="t2-rollzone-coin">
            <button
              className={'t2-coin-start' + (coinSpinning ? ' spinning' : ' pulsing')}
              onClick={startCoinFlip}
              disabled={coinSpinning}
              aria-label="Start — flip the coin"
            >
              <BallMark size={coinSize} variant="onInk" />
            </button>
            <div className="t2-rollzone-caption">Coin Flip<br /><span className="t2-coin-hint">Winner opens on offense</span></div>
          </div>
        );
      }
      return (
        <div className="t2-rollzone-coin t2-fade-in">
          <div className="t2-coin"><div className="t2-coin-face">{turn.coinFace}</div><div className="t2-coin-brand">Nine Deep</div></div>
          <div className="t2-rollzone-caption">{turn.order[0].name} Wins The Tip<br /><span>Opens on offense for Exchange 1</span></div>
        </div>
      );
    }
    if (turn.stage === 'card') {
      // Nothing is actually being rolled yet at this point (cards aren't even decided) — this
      // previews both dice at rest, sized to what each side would actually roll, so the board
      // always shows two dice the whole exchange, never just one. Each team's die always sits
      // on the same physical side as that team's own board (topSide/bottomSide) — offense and
      // defense swap sides between exchanges (whoever doesn't have the ball defends), but a
      // given team's die never visually moves; only which role it's playing changes. The
      // possession arrow points toward whichever side currently has the ball.
      const leftTeam = teamOf(topSide);
      const rightTeam = teamOf(bottomSide);
      const leftIsOffense = offenseTeam === leftTeam;
      const leftSides = leftIsOffense ? offenseDieSize(leftTeam) : defenseDieSize(leftTeam);
      const rightSides = leftIsOffense ? defenseDieSize(rightTeam) : offenseDieSize(rightTeam);
      return (
        <div className="t2-rollzone-dual">
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={leftSides} value={leftSides} size={dieSize} /></div>
            <div className="t2-rollzone-caption">{leftTeam.name} On {leftIsOffense ? 'Offense' : 'Defense'}</div>
          </div>
          <div className="t2-possession">
            <div className="t2-possession-label">Possession</div>
            <div className={'t2-possession-arrow' + (leftIsOffense ? '' : ' flip')} />
          </div>
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={rightSides} value={rightSides} size={dieSize} /></div>
            <div className="t2-rollzone-caption">{rightTeam.name} On {leftIsOffense ? 'Defense' : 'Offense'}</div>
          </div>
        </div>
      );
    }
    if (turn.stage === 'resolved') {
      const offSide = turn.offenseSide, defSide = turn.defenseSide;
      const offTeam = offSide === 'a' ? teamA : teamB;
      const defTeam = defSide === 'a' ? teamA : teamB;
      const offDie = turn[`${offSide}OffDie`], offSides = turn[`${offSide}OffSides`];
      const defDie = turn[`${defSide}DefDie`], defSides = turn[`${defSide}DefSides`];

      // Both dice stay on the board the whole exchange — offense's sits at its rest/size
      // preview until it settles, defense's does the same. Only the acting side's own
      // controlling human ever gets the clickable die for their turn; an AI side rolls itself
      // (see the effect above), and a human opponent's side just sits idle here until their own
      // client rolls it.
      const offRolling = rollPhase === 'rolling-off';
      const offSettled = !['idle-off', 'rolling-off'].includes(rollPhase);
      const offInteractive = !revealingAdjustments && rollPhase === 'idle-off' && offTeam === myTeam;
      const defRolling = rollPhase === 'rolling-def';
      const defSettled = ['revealed-def', 'both'].includes(rollPhase);
      const defInteractive = !revealingAdjustments && rollPhase === 'idle-def' && defTeam === myTeam;
      const offBreakdown = turn[`${offSide}OffBreakdown`];
      const defBreakdown = turn[`${defSide}DefBreakdown`], defMod = turn[`${defSide}DefMod`];
      const offWon = turn[`${offSide}OffWon`], offRaw = turn[`${offSide}OffRaw`], offTotal = turn[`${offSide}OffTotal`];
      const haircutPct = Math.round((turn[`${offSide}Haircut`] || 0) * 100);
      // Only knowable once defense's own die has actually revealed — same gate as the full
      // report below, so this never spoils the outcome before defense's roll lands on screen.
      const showCut = rollPhase === 'both' && !offWon;
      // Offense/defense swap which physical die they occupy between exchanges (whoever doesn't
      // have the ball defends), but each team's own die never visually moves — it always sits
      // on the same side as that team's board (topSide/bottomSide), matching the board's own
      // stability, so nothing appears to swap sides mid-match the way roles do.
      const offenseIsLeft = offTeam === teamOf(topSide);

      const offenseBlock = (
        <div className="t2-rollzone-die" key="offense">
          <div className={'t2-die-stage' + (offInteractive ? ' t2-die-clickable' : '') + (showCut ? ' t2-die-cut' : '')} onClick={offInteractive ? () => startRoll('off') : undefined}>
            <Die sides={offSides} value={offSettled ? offDie : offSides} size={dieSize} rolling={offRolling} />
            {rollPhase === 'idle-off' && offInteractive && <span className="t2-die-roll-label">Roll</span>}
          </div>
          <div className="t2-rollzone-caption">
            {offSettled ? `${offTeam.name} Rolls ${offDie}` : `${offTeam.name} On Offense`}
            {offSettled && (
              <button className="t2-mod-info" aria-label="Show offense output breakdown" onClick={() => setBreakdownOpen((v) => (v === 'off' ? null : 'off'))}>+{offRaw}</button>
            )}
          </div>
          {breakdownOpen === 'off' && renderModBreakdown(offTeam, 'offense', offBreakdown)}
        </div>
      );

      const defenseBlock = (
        <div className="t2-rollzone-die" key="defense">
          <div className={'t2-die-stage' + (defInteractive ? ' t2-die-clickable' : '')} onClick={defInteractive ? () => startRoll('def') : undefined}>
            <Die sides={defSides} value={defSettled ? defDie : defSides} size={dieSize} rolling={defRolling} />
            {rollPhase === 'idle-def' && defInteractive && <span className="t2-die-roll-label">Roll</span>}
          </div>
          <div className="t2-rollzone-caption">
            {defSettled ? `${defTeam.name} Rolls ${defDie}` : `${defTeam.name} On Defense`}
            {defSettled && (
              <button className="t2-mod-info" aria-label="Show defense mod breakdown" onClick={() => setBreakdownOpen((v) => (v === 'def' ? null : 'def'))}>+{defMod}</button>
            )}
          </div>
          {breakdownOpen === 'def' && renderModBreakdown(defTeam, 'defense', defBreakdown)}
        </div>
      );

      return (
        <div className="t2-rollzone-dual">
          {offenseIsLeft ? offenseBlock : defenseBlock}

          {rollPhase === 'both' ? (
            // The possession arrow's job — "here's who has it" — is done the instant both dice
            // land; a full report of the same possession slots into that exact spot instead of
            // popping up as a separate dialog elsewhere, so reading the breakdown never means
            // looking away from the dice that produced it. t2-report-spin-in plays the arrow's
            // own spin-and-blur into the report appearing, rather than a plain fade.
            <div className="t2-possession t2-possession-report t2-report-spin-in">
              <div className="t2-report-winner">{offWon ? offTeam.name : defTeam.name} Wins</div>
              {reportStage !== 'winner' && (
                <div className="t2-report-row t2-fade-in">
                  <span>{offTeam.name} Offense</span>
                  <span>{offWon
                    ? `+${formatTally(offenseCount)}`
                    : <span className="t2-report-cut"><s>+{offRaw}</s> +{formatTally(offenseCount)} <em>(−{haircutPct}% from {defTeam.name}'s defense)</em></span>}</span>
                </div>
              )}
              {(reportStage === 'defense' || reportStage === 'done') && (
                <div className="t2-report-row t2-report-row-last t2-fade-in">
                  <span>{defTeam.name} Defense</span><span>+{formatTally(defenseCount)}</span>
                </div>
              )}
              {reportStage === 'done' && (
                <div className="t2-report-footer t2-fade-in">
                  {!autoProgress && (
                    <button className="t2-next-possession" onClick={() => advance()}>
                      {turn.exchangeIndex === 0 ? 'Start Next Possession' : 'Start Bench Contribution'}
                    </button>
                  )}
                  <label className="t2-auto-progress">
                    <input type="checkbox" checked={autoProgress} onChange={(e) => toggleAutoProgress(e.target.checked)} />
                    Auto-progress
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="t2-possession">
              <div className="t2-possession-label">Possession</div>
              <div className={'t2-possession-arrow' + (offenseIsLeft ? '' : ' flip')} />
            </div>
          )}

          {offenseIsLeft ? defenseBlock : offenseBlock}
        </div>
      );
    }
    // Bench: reveals the coin-toss winner's contribution, then the other team's, then a final
    // result card naming the winner and a margin-flavored blurb — see the benchPhase effects.
    const [firstTeam, secondTeam] = benchOrder;
    if (benchPhase === 'first') {
      return (
        <div className="t2-rollzone-coin">
          <div className="t2-coin"><div className="t2-coin-face">BENCH</div><div className="t2-coin-brand">Contribution</div></div>
          <div className="t2-rollzone-caption">Adding {firstTeam.name}'s bench</div>
        </div>
      );
    }
    if (benchPhase === 'second') {
      return (
        <div className="t2-rollzone-coin t2-fade-in">
          <div className="t2-coin"><div className="t2-coin-face">BENCH</div><div className="t2-coin-brand">Contribution</div></div>
          <div className="t2-rollzone-caption">Adding {secondTeam.name}'s bench</div>
        </div>
      );
    }
    const aSum = Math.round((turn.aOffTotal + turn.aDefTotal + turn.aBench + turn.extraA.leagueMod) * 100) / 100;
    const bSum = Math.round((turn.bOffTotal + turn.bDefTotal + turn.bBench + turn.extraB.leagueMod) * 100) / 100;
    const winnerTeam = m.result?.winner || (aSum >= bSum ? teamA : teamB);
    return (
      <div className="t2-rollzone-coin t2-fade-in">
        <div className="t2-coin"><div className="t2-coin-face">🏆</div><div className="t2-coin-brand">Final</div></div>
        <div className="t2-rollzone-caption">{winnerTeam.name} Wins<br /><span>{resultBlurb}</span></div>
        {m.result && onBack && (
          <button className="t2-back-to-bracket" onClick={onBack}>Back to Playoff Bracket</button>
        )}
      </div>
    );
  };

  const renderPlayedCards = (entries) => (
    <div className="t2-played-cards">
      {entries.map((entry, i) => (
        <div className="t2-played-card" key={`${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`}>
          <div className="t2-played-card-title">{entry.teamName} played {entry.cardName}</div>
          {entry.description && <div className="t2-played-card-description">{entry.description}</div>}
        </div>
      ))}
    </div>
  );

  // While a side's die is actively tumbling (and for a beat after, while its number is still
  // fresh on screen), that side's five active players glow on their team board — a visual line
  // from "these five stat lines" to "this roll," not just a number appearing out of nowhere.
  const rollingSide = ['rolling-off', 'revealed-off'].includes(rollPhase) ? offenseTeam
    : ['rolling-def', 'revealed-def'].includes(rollPhase) ? defenseTeam : null;

  return (
    <div className="t2-shell">
      {revealingAdjustments && (
        <div className="t2-adjustment-reveal" aria-live="polite">
          {visibleBoardActions.map((entry, i) => (
            <div className={'t2-adjustment-reveal-card ' + (entry.teamName === teamOf(topSide).name ? 'settle-top' : 'settle-bottom')} key={`${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`}>
              <div className="t2-adjustment-reveal-team">{entry.teamName} played</div>
              {entry.card ? <MatchupCard card={entry.card} playoff /> : renderPlayedCards([entry])}
            </div>
          ))}
        </div>
      )}
      <div className={'t2-body' + (logCollapsed ? ' log-collapsed' : '')}>
        <div className="t2-board">
          <TeamBoard
            team={teamOf(topSide)} ids={idsOf(topSide)} hca={hcaOf(topSide)}
            statusLabel={statusFor(topSide)} roleLabel={roleFor(teamOf(topSide))}
            cardPlays={cardsOf(topSide)} gameplanPlays={gameplansOf(topSide)}
            gameplanCanPlay={gameplanCanPlayFor(teamOf(topSide))} adjustmentCanPlay={adjustmentCanPlayFor(teamOf(topSide))}
            onAdjustmentSlotClick={() => setAdjustmentPickerOpen(true)}
            isActive={offenseTeam === teamOf(topSide) || defenseTeam === teamOf(topSide)} contributing={rollingSide === teamOf(topSide)}
            timerPercent={timerFor(teamOf(topSide))} benchContribution={benchVisibleFor(teamOf(topSide))}
          />

          <div className="t2-rollzone">
            {renderRollCircle()}

            {turn.stage === 'card' && myTurnToAct && adjustmentPickerOpen && (
              <div className="t2-adjustment-picker-window">
                <div className="t2-adjustment-picker" role="dialog" aria-modal="true" aria-label="Play an Adjustment card">
                  <div className="t2-carddecision-head">
                    <div className="t2-carddecision-title"><span>Play An Adjustment Card</span><span className={'t2-timer' + (timeLeft <= 3 ? ' urgent' : '')}>{Math.ceil(timeLeft)}s</span></div>
                    <button type="button" className="t2-carddecision-close" onClick={() => { setSelectedAdjustment(null); setAdjustmentPickerOpen(false); }} aria-label="Close">×</button>
                  </div>
                  <div className="t2-carddecision-desc">Choose one available card or pass. Your selection stays hidden until both teams lock in.</div>
                  <div className="t2-adjustment-picker-cards">
                    {availableAdjustments.map((card) => <button key={card.id} className={'t2-adjustment-picker-card' + (selectedAdjustment?.id === card.id ? ' selected' : '')} onClick={() => chooseAdjustment(card)}><MatchupCard card={card} playoff /></button>)}
                    {!availableAdjustments.length && <div className="t2-waiting">No Adjustment cards are available.</div>}
                  </div>
                  {selectedAdjustment && (
                    <div className="t2-adjustment-targets">
                      <div className="db-target-picker-head">Choose a target — {selectedAdjustment.name}</div>
                      {!adjustmentTargets.length && <div className="db-target-picker-empty">No eligible starter.</div>}
                      {adjustmentTargets.flatMap((player) => (selectedAdjustment.effectType ? PLAYER_STATS : [null]).map((stat) => (
                        <button key={`${player.id}-${stat}`} className="db-target-btn" onClick={() => { advance({ cardId: selectedAdjustment.id, targetId: player.id, stat }); setSelectedAdjustment(null); }}>
                          {player.position} · {player.archetype}{stat ? ` · ${stat} (${player.stats[stat]})` : ''}
                        </button>
                      )))}
                    </div>
                  )}
                  <button className="t2-pass-btn" onClick={() => { setSelectedAdjustment(null); advance({ pass: true }); }}>Pass</button>
                </div>
              </div>
            )}

            {turn.stage === 'card' && waitingOnOpponent && (
              <div className="t2-waiting">Waiting on {actingTeam.name} to lock in a card…</div>
            )}

          </div>

          <TeamBoard
            team={teamOf(bottomSide)} ids={idsOf(bottomSide)} hca={hcaOf(bottomSide)}
            statusLabel={statusFor(bottomSide)} roleLabel={roleFor(teamOf(bottomSide))}
            cardPlays={cardsOf(bottomSide)} gameplanPlays={gameplansOf(bottomSide)}
            gameplanCanPlay={gameplanCanPlayFor(teamOf(bottomSide))} adjustmentCanPlay={adjustmentCanPlayFor(teamOf(bottomSide))}
            onAdjustmentSlotClick={() => setAdjustmentPickerOpen(true)}
            isActive={offenseTeam === teamOf(bottomSide) || defenseTeam === teamOf(bottomSide)} contributing={rollingSide === teamOf(bottomSide)}
            timerPercent={timerFor(teamOf(bottomSide))} benchContribution={benchVisibleFor(teamOf(bottomSide))}
            flip
          />
        </div>

        <div className={'t2-log' + (logCollapsed ? ' collapsed' : '')}>
          <div className="t2-log-head">
            {!logCollapsed && <div className="t2-log-heading">Game Log</div>}
            <button
              className="t2-log-toggle"
              onClick={toggleLogCollapsed}
              aria-label={logCollapsed ? 'Show game log' : 'Hide game log'}
              title={logCollapsed ? 'Show game log' : 'Hide game log'}
            >
              {logCollapsed ? '☰' : '×'}
            </button>
          </div>
          {!logCollapsed && (
            <div className="t2-log-body">
              {visibleLog.map((n, i) => (
                <div key={i} className="t2-log-entry">{n.text}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
