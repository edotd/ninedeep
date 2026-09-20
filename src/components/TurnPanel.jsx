import { useEffect, useRef, useState } from 'react';
import { playableCards } from '../game/matchup';
import { PLAYER_STATS, eligibleStatTargets } from '../game/supplementalEffects';
import { offenseDieSize, defenseDieSize } from '../game/roster';
import Die, { ROLL_DURATION_MS } from './Die';
import BallMark from './BallMark';
import CompactPlayerTile from './CompactPlayerTile';
import CompactCoachCard from './CompactCoachCard';

// Decision clock for a blind matchup-card choice — long enough to read your hand, short
// enough to put real pressure on the pick. Auto-passes on timeout so a stalled player can't
// freeze the match for their opponent.
const CARD_TIMER_SECONDS = 8;

// How long the coin spins before the flip actually resolves, and how long the result reads
// on screen before auto-advancing into the first card window — both purely presentational
// delays around the instant, synchronous advanceTurn() call.
const COIN_SPIN_MS = 900;
const COIN_RESULT_MS = 1400;

// The engine resolves both of an exchange's dice in one atomic step, but the roll zone plays
// them back as a little sequence a click at a time — offense's die sits at rest until Roll is
// clicked, spins for ROLL_DURATION_MS and reveals, then after a read pause defense's die does
// the same, then both sit together before auto-advancing. All purely presentational timing
// around numbers that are already final the moment turn.stage becomes 'resolved'.
const ROLL_REVEAL_MS = 700;
const ROLL_BOTH_READ_MS = 1600;

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

// Every sub-stage the engine (game/turn.js) can be in, in order — drives the "STAGE n / total"
// footer counter. coinflip/coinflipped share stage 1 (the coin only "advances" once, from the
// player's point of view, even though the engine models the flip and its reveal as two
// stages); 'card' appears twice per exchange (offense's window, then defense's).
const STAGE_ORDER = ['coinflip', 'coinflipped', 'card-offense-0', 'card-defense-0', 'resolved-0', 'card-offense-1', 'card-defense-1', 'resolved-1', 'bench'];

function stageKey(turn) {
  if (turn.stage === 'card') return `card-${turn.current.role}-${turn.exchangeIndex}`;
  if (turn.stage === 'resolved') return `resolved-${turn.exchangeIndex}`;
  return turn.stage;
}

function stageNumber(turn) {
  const idx = STAGE_ORDER.indexOf(stageKey(turn));
  return Math.max(1, idx === 0 ? 1 : idx);
}

function chipSlots(cards, count) {
  return Array.from({ length: count }, (_, i) => cards[i] || null);
}

// "Coach in front" layout, per the Match Flow design doc's 8A board: all nine rotation tiles
// (starters then bench, no separate grouping) line up in one row at the board's outer edge,
// with the Head Coach card overlapping the row's near-center edge and the team name sitting
// closer still to the shared roll zone in between. `flip` mirrors the bottom team's board (via
// a CSS column-reverse over this [roster, name] pair) so the roster stays at the outer edge
// and the name stays innermost for both teams; `edge` tells each tile/coach card which of its
// own sides faces the roll zone, so the accent border and the coach card's overlap land on the
// right side for either team.
function TeamBoard({ team, ids, hca, statusLabel, isActive, flip }) {
  const hand = team.hand || [];
  const activeIds = ids || team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const edge = flip ? 'top' : 'bottom';
  return (
    <div className={'t2-teamboard' + (isActive ? ' active' : '') + (flip ? ' flip' : '')}>
      <div className="nd2-roster">
        {chipSlots(starters, 5).map((c, i) => (c ? <CompactPlayerTile key={`s${i}`} card={c} isStarter edge={edge} /> : <div key={`s${i}`} className="nd2-tile empty" />))}
        {chipSlots(bench, 4).map((c, i) => (c ? <CompactPlayerTile key={`b${i}`} card={c} edge={edge} /> : <div key={`b${i}`} className="nd2-tile empty" />))}
        {team.coach && (
          <div className={'nd2-coach-slot' + (edge === 'top' ? ' edge-top' : ' edge-bottom')}>
            <CompactCoachCard team={team} edge={edge} />
          </div>
        )}
      </div>
      <div className="t2-teamboard-name">
        {hca && <span className="t2-hca-tag">Home Court</span>}
        <div className="t2-teamboard-name-text">{team.name}</div>
        {statusLabel && <div className="t2-teamboard-status">{statusLabel}</div>}
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
export default function TurnPanel({ state, actions, m, myTeamId }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [targetPickerCardId, setTargetPickerCardId] = useState(null);
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
    if (rollPhase !== `idle-${which}`) return;
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
    } else if (rollPhase === 'both') {
      rollTimerRef.current = setTimeout(() => advance(), ROLL_BOTH_READ_MS);
    }
    return () => clearTimeout(rollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollPhase]);

  // Only the side's own controlling human ever clicks its die — an AI-controlled side (or the
  // other real player's side, in online play) never waits on this client's click. AI sides
  // start themselves after a short beat, same idea as the AI card auto-advance above; a human
  // opponent's side just sits idle here until their own client calls startRoll.
  useEffect(() => {
    if (turn.stage !== 'resolved') return undefined;
    let t;
    if (rollPhase === 'idle-off' && offenseTeam && !offenseTeam.human) t = setTimeout(() => startRoll('off'), 500);
    else if (rollPhase === 'idle-def' && defenseTeam && !defenseTeam.human) t = setTimeout(() => startRoll('def'), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollPhase, turn.stage]);

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

  useEffect(() => {
    setTargetPickerCardId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.exchangeIndex, cur?.team, cur?.role, turn.stage]);

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

  const myOptions = myTurnToAct ? playableCards(myTeam) : [];

  // Blind by convention: a card play is logged the instant it's chosen, but withheld from
  // display until its own exchange resolves — otherwise the second team to act (or a
  // spectator watching both) would read the first team's pick before committing their own.
  // A roll's numbers are likewise final in game state well before the click-to-roll animation
  // plays them out — an exchange's "resolution" line waits for rollPhase to actually reach
  // 'both', and the two "bench" lines wait for the bench reveal's own 'result' phase, so the
  // log never spoils a result the roll-zone hasn't shown yet.
  const visibleLog = turn.log.filter((e) => {
    if (e.tag === 'action') return e.stepIndex < turn.exchangeIndex || turn.stage === 'resolved' || turn.stage === 'bench';
    if (e.tag === 'resolution') return !(turn.stage === 'resolved' && e.stepIndex === turn.exchangeIndex) || rollPhase === 'both';
    if (e.tag === 'bench') return turn.stage !== 'bench' || benchPhase === 'result';
    return true;
  });

  const advanceLabel = 'Finish Turn';
  // Only the bench stage still needs a manual footer button — the coin flip, a card decision
  // (human's own picker, a wait message for a live opponent, or the auto-advance above for an
  // AI), and a resolving roll all move themselves along without one.
  const showGenericAdvance = turn.stage === 'bench' && benchPhase === 'result';

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
              <BallMark size={130} variant="onInk" />
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
      // is just a preview of the die size in play, sitting at rest.
      const sides = cur.role === 'offense' ? offenseDieSize(actingTeam) : defenseDieSize(actingTeam);
      return (
        <div className="t2-rollzone-die">
          <div className="t2-die-stage"><Die sides={sides} value={sides} size={150} /></div>
        </div>
      );
    }
    if (turn.stage === 'resolved') {
      const offSide = turn.offenseSide, defSide = turn.defenseSide;
      const offTeam = offSide === 'a' ? teamA : teamB;
      const defTeam = defSide === 'a' ? teamA : teamB;
      const offDie = turn[`${offSide}OffDie`], offSides = turn[`${offSide}OffSides`];
      const defDie = turn[`${defSide}DefDie`], defSides = turn[`${defSide}DefSides`];

      // Idle and rolling both show the die at rest/spinning respectively — only the reveal
      // afterward needs its own real value. Only the acting side's own controlling human ever
      // gets the clickable die/Roll button; an AI side rolls itself (see the effect above),
      // and a human opponent's side just sits idle here until their own client rolls it.
      if (rollPhase === 'idle-off' || rollPhase === 'rolling-off') {
        const rolling = rollPhase === 'rolling-off';
        const mine = offTeam === myTeam;
        return (
          <div className="t2-rollzone-die">
            <div className={'t2-die-stage' + (mine ? ' t2-die-clickable' : '')} onClick={mine ? () => startRoll('off') : undefined}><Die sides={offSides} value={offSides} size={150} rolling={rolling} /></div>
            <div className="t2-rollzone-caption">{offTeam.name} Rolls For Offense</div>
            {!rolling && mine && <button className="t2-roll-btn" onClick={() => startRoll('off')}>Roll</button>}
          </div>
        );
      }
      if (rollPhase === 'revealed-off') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={offSides} value={offDie} size={150} /></div>
            <div className="t2-rollzone-caption t2-fade-in">{offTeam.name} Rolls {offDie}</div>
          </div>
        );
      }
      if (rollPhase === 'idle-def' || rollPhase === 'rolling-def') {
        const rolling = rollPhase === 'rolling-def';
        const mine = defTeam === myTeam;
        return (
          <div className="t2-rollzone-die">
            <div className={'t2-die-stage' + (mine ? ' t2-die-clickable' : '')} onClick={mine ? () => startRoll('def') : undefined}><Die sides={defSides} value={defSides} size={150} rolling={rolling} /></div>
            <div className="t2-rollzone-caption">{defTeam.name} Rolls For Defense</div>
            {!rolling && mine && <button className="t2-roll-btn" onClick={() => startRoll('def')}>Roll</button>}
          </div>
        );
      }
      if (rollPhase === 'revealed-def') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={defSides} value={defDie} size={150} /></div>
            <div className="t2-rollzone-caption t2-fade-in">{defTeam.name} Rolls {defDie}</div>
          </div>
        );
      }
      return (
        <div className="t2-rollzone-dual t2-fade-in">
          <div className="t2-rollzone-die"><div className="t2-die-stage"><Die sides={offSides} value={offDie} size={130} /></div><div className="t2-rollzone-caption">Offense<br /><span>{offTeam.name}</span></div></div>
          <div className="t2-rollzone-die"><div className="t2-die-stage"><Die sides={defSides} value={defDie} size={130} /></div><div className="t2-rollzone-caption">Defense<br /><span>{defTeam.name}</span></div></div>
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
    const winnerTeam = aSum >= bSum ? teamA : teamB;
    return (
      <div className="t2-rollzone-coin t2-fade-in">
        <div className="t2-coin"><div className="t2-coin-face">🏆</div><div className="t2-coin-brand">Final</div></div>
        <div className="t2-rollzone-caption">{winnerTeam.name} Wins<br /><span>{resultBlurb}</span></div>
      </div>
    );
  };

  return (
    <div className="t2-shell">
      <div className="t2-body">
        <div className="t2-board">
          <TeamBoard team={teamA} ids={turn.idsA} hca={turn.hcaA} statusLabel={statusFor('a')} isActive={offenseTeam === teamA || defenseTeam === teamA} />

          <div className="t2-rollzone">
            {renderRollCircle()}

            {turn.stage === 'card' && myTurnToAct && (
              <div className="t2-carddecision">
                <div className="t2-carddecision-head">
                  <span>Play A Matchup Card?</span>
                  <span className={'t2-timer' + (timeLeft <= 3 ? ' urgent' : '')}>{Math.ceil(timeLeft)}s</span>
                </div>
                <div className="t2-carddecision-desc">Both teams lock in a card — or pass — blind, before either die is rolled.</div>
                <div className="t2-cards">
                  {myOptions.length === 0 && <div className="t2-waiting">No card to play this possession.</div>}
                  {myOptions.map((c) => {
                    const isPicking = targetPickerCardId === c.id;
                    const targetTeam = c.target === 'self' ? myTeam : (actingTeam === teamA ? teamB : teamA);
                    const targetIds = targetTeam === teamA ? turn.idsA : turn.idsB;
                    const targetPlayers = eligibleStatTargets(targetTeam, targetIds, c);
                    return (
                      <div key={c.id}>
                        <button
                          className="t2-card-btn"
                          disabled={c.targetsPlayer && targetPlayers.length === 0}
                          onClick={() => {
                            if (c.targetsPlayer) { setTargetPickerCardId(isPicking ? null : c.id); return; }
                            advance({ cardId: c.id });
                          }}
                        >
                          <span className="t2-card-name">{c.name}{c.rarity ? ` · ${c.rarity}` : ''}</span>
                          {c.description && <span>{c.description} · </span>}
                          {c.targetsPlayer && targetPlayers.length === 0 && <span>No eligible starter · </span>}
                          {c.targetsPlayer ? `Choose a target on ${targetTeam.name}` : `Play on ${targetTeam.name}`}
                        </button>
                        {isPicking && (
                          <div style={{ marginTop: 6, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {targetPlayers.flatMap((oc) => (c.targetsPlayer && c.effectType ? PLAYER_STATS : [null]).map((stat) => (
                              <button
                                key={`${oc.id}-${stat}`}
                                className="t2-card-btn"
                                onClick={() => { advance({ cardId: c.id, targetId: oc.id, stat }); setTargetPickerCardId(null); }}
                              >
                                {oc.position} · {oc.archetype}{stat ? ` · ${stat} (${oc.stats[stat]})` : ''}{c.effectType === 'CAP_HIT_STAT' ? ` · +${oc.salary}` : ''}
                              </button>
                            )))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
              const defTotal = turn[`${defSide}DefTotal`];
              return (
                <div className="t2-report t2-fade-in">
                  <div className="t2-report-row"><span className="t2-report-label">Possession</span><span>{offWon ? `${offTeam.name} wins` : `${defTeam.name} wins`}</span></div>
                  <div className="t2-report-row"><span className="t2-report-label">{offTeam.name} Offense</span><span>+{offTotal}{!offWon ? ' (reduced)' : ''}</span></div>
                  <div className="t2-report-row"><span className="t2-report-label">{defTeam.name} Defense</span><span>+{defTotal}</span></div>
                </div>
              );
            })()}

          </div>

          <TeamBoard team={teamB} ids={turn.idsB} hca={turn.hcaB} statusLabel={statusFor('b')} isActive={offenseTeam === teamB || defenseTeam === teamB} flip />

          <div className="t2-board-footer">
            <div className="t2-board-caption">Both rosters and both front offices stay on the table all game. Spent matchup cards hold their slot, struck through.</div>
            <div className="t2-board-actions">
              <button className="t2-restart-btn" onClick={() => actions.beginTurn()}>Restart Turn</button>
              <span className="t2-stage-counter">Stage {stageNumber(turn)} / {STAGE_ORDER.length - 1}</span>
              {showGenericAdvance && (
                <button className="t2-advance-btn" onClick={() => advance()}>{advanceLabel}</button>
              )}
            </div>
          </div>
        </div>

        <div className="t2-log">
          <div className="t2-log-heading">Game Log</div>
          <div className="t2-log-body">
            {visibleLog.map((n, i) => (
              <div key={i} className="t2-log-entry">{n.text}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
