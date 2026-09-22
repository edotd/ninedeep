import { useEffect, useRef, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { offenseDieSize, defenseDieSize } from '../game/roster';
import Die, { ROLL_DURATION_MS } from './Die';
import BallMark from './BallMark';
import CompactPlayerTile from './CompactPlayerTile';
import CompactCoachCard from './CompactCoachCard';
import MatchupCard from './MatchupCard';

// Decision clock for a blind matchup-card choice — long enough to read your hand, short
// enough to put real pressure on the pick. Auto-passes on timeout so a stalled player can't
// freeze the match for their opponent.
const CARD_TIMER_SECONDS = 12;

// How long the coin spins before the flip actually resolves, and how long the result reads
// on screen before auto-advancing into the first card window — both purely presentational
// delays around the instant, synchronous advanceTurn() call.
const COIN_SPIN_MS = 900;
const COIN_RESULT_MS = 1400;

// The engine resolves both of an exchange's dice in one atomic step, but the roll zone plays
// them back as a little sequence a click at a time — offense's die sits at rest until Roll is
// clicked, spins for ROLL_DURATION_MS and reveals, then after a read pause defense's die does
// the same. The first exchange pauses for a Start Next Possession click; the second continues
// to the bench. All timing is presentational around already-final resolved numbers.
const ROLL_REVEAL_MS = 700;
const ROLL_BOTH_READ_MS = 1600;
const ADJUSTMENT_REVEAL_MS = 2200;

// The bench stage reveals the same way: the coin-toss winner's bench figure first, a read
// pause, then the other team's, then a final read pause before the result card appears.
const BENCH_REVEAL_MS = 1300;
const BENCH_RESULT_MS = 1300;

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
// name: below the home roster on the left, and above the away roster on the right.
function TeamBoard({ team, ids, hca, statusLabel, roleLabel, cardPlays, isActive, flip, contributing }) {
  const hand = team.hand || [];
  const activeIds = ids || team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const edge = flip ? 'top' : 'bottom';
  return (
    <div className={'t2-teamboard' + (isActive ? ' active' : '') + (flip ? ' flip' : '')}>
      <div className="nd2-roster">
        {chipSlots(starters, 5).map((c, i) => (c ? <CompactPlayerTile key={`s${i}`} card={c} isStarter edge={edge} contributing={contributing} /> : <div key={`s${i}`} className="nd2-tile empty" />))}
        {chipSlots(bench, 4).map((c, i) => (c ? <CompactPlayerTile key={`b${i}`} card={c} edge={edge} /> : <div key={`b${i}`} className="nd2-tile empty" />))}
      </div>
      <div className="t2-teamboard-meta">
        {team.coach && <div className="nd2-coach-slot"><CompactCoachCard team={team} edge={edge} /></div>}
        <div className="t2-teamboard-name">
          {hca && !flip && <span className="t2-hca-tag">Home Court</span>}
          <div className="t2-teamboard-name-line">
            {roleLabel && <span className={'t2-team-role ' + roleLabel.toLowerCase()}>{roleLabel}</span>}
            <div className="t2-teamboard-name-text">{team.name}</div>
          </div>
          {statusLabel && <div className="t2-teamboard-status">{statusLabel}</div>}
          {cardPlays?.length > 0 && (
            <div className="t2-adjustment-dock">
              {cardPlays.map((entry, i) => (
                <div className="t2-adjustment-mini" key={`${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`} title={entry.description}>
                  {entry.card ? <MatchupCard card={entry.card} playoff /> : <span>{entry.cardName}</span>}
                </div>
              ))}
            </div>
          )}
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
  const isDesktop = useIsDesktop();
  const dieSize = isDesktop ? 96 : 80;
  const coinSize = isDesktop ? 100 : 84;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [timeLeft, setTimeLeft] = useState(CARD_TIMER_SECONDS);
  const [coinSpinning, setCoinSpinning] = useState(false);
  const coinTimerRef = useRef(null);
  // 'idle-off' | 'rolling-off' | 'revealed-off' | 'idle-def' | 'rolling-def' | 'revealed-def' | 'both'
  const [rollPhase, setRollPhase] = useState('idle-off');
  const rollTimerRef = useRef(null);
  // 'first' | 'second' | 'result' — the bench stage's own reveal sequence, mirroring rollPhase.
  const [benchPhase, setBenchPhase] = useState('first');
  const benchTimerRef = useRef(null);
  const [resultBlurb, setResultBlurb] = useState('');
  // Which side's mod-breakdown popover is open, if any — 'off' | 'def' | null. Reset whenever
  // the exchange or stage moves on, so it never lingers open over stale numbers.
  const [breakdownOpen, setBreakdownOpen] = useState(null);
  useEffect(() => { setBreakdownOpen(null); }, [turn.stage, turn.exchangeIndex]);
  const [logCollapsed, setLogCollapsed] = useState(readLogCollapsed);
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
    } else if (rollPhase === 'both' && autoProgress) {
      // With auto-progress off (the default), both post-roll reports wait on their own
      // "Start Next Possession" / "See Bench Contributions" click instead of advancing here.
      rollTimerRef.current = setTimeout(() => advance(), ROLL_BOTH_READ_MS);
    }
    return () => clearTimeout(rollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollPhase, turn.exchangeIndex, autoProgress]);

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
    stepIndex: -1,
  }));
  // Each played-card notice draws on the side of the board the team that played it sits on,
  // rather than lumped together in the middle — teamA's play appears above the roll circle
  // (next to teamA's board), teamB's below (next to teamB's).
  const teamACardPlays = visibleBoardActions.filter((entry) => entry.teamName === teamA.name);
  const teamBCardPlays = visibleBoardActions.filter((entry) => entry.teamName === teamB.name);
  const settledTeamACards = revealingAdjustments ? [] : teamACardPlays;
  const settledTeamBCards = revealingAdjustments ? [] : teamBCardPlays;

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
            <div className="t2-rollzone-caption">Coin Flip<br /><span>Winner opens on offense</span></div>
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
      // always shows two dice the whole exchange, never just one. Offense is always the left
      // die and defense the right one for the whole exchange (both here and in the resolved
      // stage below), so the possession arrow just points at offense the whole time — it used
      // to also flip to track whichever side was currently acting (card pick, then roll), which
      // read as flickering back and forth for no real reason since the two sides never actually
      // swap screen position mid-exchange.
      const offSides = offenseDieSize(offenseTeam);
      const defSides = defenseDieSize(defenseTeam);
      return (
        <div className="t2-rollzone-dual">
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={offSides} value={offSides} size={dieSize} /></div>
            <div className="t2-rollzone-caption">{offenseTeam.name} On Offense</div>
          </div>
          <div className="t2-possession">
            <div className="t2-possession-label">Possession</div>
            <div className="t2-possession-arrow" />
          </div>
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={defSides} value={defSides} size={dieSize} /></div>
            <div className="t2-rollzone-caption">{defenseTeam.name} On Defense</div>
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
      // preview until it settles, defense's does the same — with a static Possession arrow
      // between them pointing at offense (always the left die for the whole exchange, in both
      // this stage and the card stage above). Only the acting side's own controlling human ever
      // gets the clickable die/Roll button for their turn; an AI side rolls itself (see the
      // effect above), and a human opponent's side just sits idle here until their own client
      // rolls it.
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

      return (
        <div className="t2-rollzone-dual">
          <div className="t2-rollzone-die">
            <div className={'t2-die-stage' + (offInteractive ? ' t2-die-clickable' : '') + (showCut ? ' t2-die-cut' : '')} onClick={offInteractive ? () => startRoll('off') : undefined}>
              <Die sides={offSides} value={offSettled ? offDie : offSides} size={dieSize} rolling={offRolling} />
            </div>
            <div className="t2-rollzone-caption">
              {offSettled ? `${offTeam.name} Rolls ${offDie}` : `${offTeam.name} On Offense`}
              {offSettled && (
                <button className="t2-mod-info" aria-label="Show offense output breakdown" onClick={() => setBreakdownOpen((v) => (v === 'off' ? null : 'off'))}>+{offRaw}</button>
              )}
            </div>
            {rollPhase === 'idle-off' && offInteractive && <button className="t2-roll-btn" onClick={() => startRoll('off')}>Roll</button>}
            {breakdownOpen === 'off' && renderModBreakdown(offTeam, 'offense', offBreakdown)}
            {showCut && (
              <div className="t2-cut-badge t2-fade-in">
                <span className="t2-cut-badge-label">{defTeam.name} defense cuts it</span>
                <span className="t2-cut-badge-value"><s>{offRaw}</s> → {offTotal}<b>−{haircutPct}%</b></span>
              </div>
            )}
          </div>

          <div className="t2-possession">
            <div className="t2-possession-label">Possession</div>
            <div className="t2-possession-arrow" />
          </div>

          <div className="t2-rollzone-die">
            <div className={'t2-die-stage' + (defInteractive ? ' t2-die-clickable' : '')} onClick={defInteractive ? () => startRoll('def') : undefined}>
              <Die sides={defSides} value={defSettled ? defDie : defSides} size={dieSize} rolling={defRolling} />
            </div>
            <div className="t2-rollzone-caption">
              {defSettled ? `${defTeam.name} Rolls ${defDie}` : `${defTeam.name} On Defense`}
              {defSettled && (
                <button className="t2-mod-info" aria-label="Show defense mod breakdown" onClick={() => setBreakdownOpen((v) => (v === 'def' ? null : 'def'))}>+{defMod}</button>
              )}
            </div>
            {rollPhase === 'idle-def' && defInteractive && <button className="t2-roll-btn" onClick={() => startRoll('def')}>Roll</button>}
            {breakdownOpen === 'def' && renderModBreakdown(defTeam, 'defense', defBreakdown)}
          </div>
        </div>
      );
    }
    // Bench: reveals the coin-toss winner's contribution, then the other team's, then a final
    // result card naming the winner and a margin-flavored blurb — see the benchPhase effects.
    const benchOrder = turn.order && turn.order.length === 2 ? turn.order : [teamA, teamB];
    const [firstTeam, secondTeam] = benchOrder;
    const benchFor = (t) => (t === teamA ? turn.aBench : turn.bBench);
    if (benchPhase === 'first') {
      return (
        <div className="t2-rollzone-coin">
          <div className="t2-coin"><div className="t2-coin-face">+{benchFor(firstTeam)}</div><div className="t2-coin-brand">Bench</div></div>
          <div className="t2-rollzone-caption">{firstTeam.name} Bench Contributes<br /><span>+{benchFor(firstTeam)} points</span></div>
        </div>
      );
    }
    if (benchPhase === 'second') {
      return (
        <div className="t2-rollzone-coin t2-fade-in">
          <div className="t2-coin"><div className="t2-coin-face">+{benchFor(secondTeam)}</div><div className="t2-coin-brand">Bench</div></div>
          <div className="t2-rollzone-caption">{secondTeam.name} Bench Contributes<br /><span>+{benchFor(secondTeam)} points</span></div>
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
            <div className="t2-adjustment-reveal-card" key={`${entry.stepIndex}-${entry.teamName}-${entry.cardName}-${i}`}>
              <div className="t2-adjustment-reveal-team">{entry.teamName} played</div>
              {entry.card ? <MatchupCard card={entry.card} playoff /> : renderPlayedCards([entry])}
            </div>
          ))}
        </div>
      )}
      <div className={'t2-body' + (logCollapsed ? ' log-collapsed' : '')}>
        <div className="t2-board">
          <TeamBoard team={teamA} ids={turn.idsA} hca={turn.hcaA} statusLabel={statusFor('a')} roleLabel={roleFor(teamA)} cardPlays={settledTeamACards} isActive={offenseTeam === teamA || defenseTeam === teamA} contributing={rollingSide === teamA} />

          <div className="t2-rollzone">
            {gameplanActions.length > 0 && renderPlayedCards(gameplanActions)}

            {renderRollCircle()}

            {turn.stage === 'card' && myTurnToAct && (
              <div className="t2-carddecision t2-carddecision-compact">
                <div className="t2-carddecision-head">
                  <span>Play A Adjustment Card</span>
                  <span className={'t2-timer' + (timeLeft <= 3 ? ' urgent' : '')}>{Math.ceil(timeLeft)}s</span>
                </div>
                <div className="t2-carddecision-desc">Click a card in your bar below, or pass — blind, before either die is rolled.</div>
                <div className="t2-carddecision-actions">
                  <button className="t2-pass-btn" onClick={() => advance({ pass: true })}>Pass</button>
                </div>
              </div>
            )}

            {turn.stage === 'card' && waitingOnOpponent && (
              <div className="t2-waiting">Waiting on {actingTeam.name} to lock in a card…</div>
            )}

            {turn.stage === 'resolved' && rollPhase === 'both' && (() => {
              const offSide = turn.offenseSide, defSide = turn.defenseSide;
              const offTeam = offSide === 'a' ? teamA : teamB;
              const defTeam = defSide === 'a' ? teamA : teamB;
              const offTotal = turn[`${offSide}OffTotal`], offWon = turn[`${offSide}OffWon`];
              const offRaw = turn[`${offSide}OffRaw`], haircutPct = Math.round((turn[`${offSide}Haircut`] || 0) * 100);
              const defTotal = turn[`${defSide}DefTotal`];
              return (
                <div className="t2-report-window t2-fade-in">
                  <div className="t2-report" role="dialog" aria-modal="true" aria-label="Possession result">
                    <div className="t2-report-row"><span className="t2-report-label">Possession</span><span>{offWon ? `${offTeam.name} wins` : `${defTeam.name} wins`}</span></div>
                    <div className="t2-report-row">
                      <span className="t2-report-label">{offTeam.name} Offense</span>
                      <span>{offWon ? `+${offTotal}` : <span className="t2-report-cut"><s>+{offRaw}</s> +{offTotal} <em>(−{haircutPct}% from {defTeam.name}'s defense)</em></span>}</span>
                    </div>
                    <div className="t2-report-row t2-report-row-last"><span className="t2-report-label">{defTeam.name} Defense</span><span>+{defTotal}</span></div>
                    <div className="t2-report-footer">
                      {!autoProgress && (
                        <button className="t2-next-possession" onClick={() => advance()}>
                          {turn.exchangeIndex === 0 ? 'Start Next Possession' : 'See Bench Contributions'}
                        </button>
                      )}
                      <label className="t2-auto-progress">
                        <input type="checkbox" checked={autoProgress} onChange={(e) => toggleAutoProgress(e.target.checked)} />
                        Auto-progress
                      </label>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

          <TeamBoard team={teamB} ids={turn.idsB} hca={turn.hcaB} statusLabel={statusFor('b')} roleLabel={roleFor(teamB)} cardPlays={settledTeamBCards} isActive={offenseTeam === teamB || defenseTeam === teamB} contributing={rollingSide === teamB} flip />
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
