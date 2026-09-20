import { useEffect, useRef, useState } from 'react';
import { playableCards } from '../game/matchup';
import { PLAYER_STATS, eligibleStatTargets } from '../game/supplementalEffects';
import { cardTier, jerseyNumber } from '../game/cards';
import { offenseDieSize, defenseDieSize } from '../game/roster';
import Die from './Die';
import BallMark from './BallMark';

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
// them back as a little sequence — pulse offense, reveal it, pulse defense, reveal it, then
// show both together — before auto-advancing. All purely presentational timing around numbers
// that are already final the moment turn.stage becomes 'resolved'.
const ROLL_PULSE_MS = 700;
const ROLL_REVEAL_MS = 700;
const ROLL_BOTH_READ_MS = 1600;

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

function PlayerSlot({ card }) {
  if (!card) return <div className="t2-pslot empty" />;
  const tier = cardTier(card);
  return (
    <div className={`t2-pslot tier-${tier.toLowerCase()}`}>
      <div className="t2-pslot-number">{jerseyNumber(card)}</div>
      <div className="t2-pslot-name">{card.archetype}</div>
      <div className="t2-pslot-position">{card.position}</div>
    </div>
  );
}

// Face-down until the card has actually been played (card.used) — never the moment a team is
// mid-decision, so a live human opponent's blind pick can't be read off this strip before it
// resolves. Once used it flips face-up for the rest of the match — this strip persists across
// every stage, so a card revealed in Exchange 1 stays revealed through Bench.
function MatchupSlot({ card }) {
  if (!card) return <div className="t2-mslot empty" />;
  if (!card.used) return <div className="t2-mslot facedown">Held</div>;
  return (
    <div className="t2-mslot used">
      <div className="t2-mslot-category">{card.category}</div>
      <div className="t2-mslot-name">{card.name}</div>
      <div className="t2-mslot-status">Spent</div>
    </div>
  );
}

function chipSlots(cards, count) {
  return Array.from({ length: count }, (_, i) => cards[i] || null);
}

// One team's full board strip: Front Office facts, team name (with a Home Court tag and a
// status line), and its 3 matchup-card slots, followed by its starters and bench rows —
// rendered above and below the roll zone so both rosters and both front offices "stay on the
// table" for the whole turn, per the design doc's 5A caption.
// `flip` mirrors the bottom team's board — its roster renders above its name/front-office
// block (via a CSS column-reverse) so both teams' rosters sit closest to the shared roll zone
// between them, matching the top team's roster sitting just above that same zone.
function TeamBoard({ team, ids, hca, statusLabel, isActive, flip }) {
  const hand = team.hand || [];
  const activeIds = ids || team.activeIds || [];
  const starters = activeIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const bench = hand.filter((c) => !activeIds.includes(c.id));
  const matchupCards = team.matchupCards || [];
  return (
    <div className={'t2-teamboard' + (isActive ? ' active' : '') + (flip ? ' flip' : '')}>
      <div className="t2-teamboard-head">
        <div className="t2-teamboard-fo">
          <div className="t2-fo-item"><span>Coach</span><b>{team.coach ? team.coach.modifier : '—'}</b></div>
          <div className="t2-fo-item"><span>GM</span><b>{team.market ? (team.gmType || 'Neutral') : '—'}</b></div>
          <div className="t2-fo-item"><span>Fanbase</span><b>{team.fanbaseArchetype ? team.fanbaseArchetype.name : '—'}</b></div>
        </div>
        <div className="t2-teamboard-name">
          {hca && <span className="t2-hca-tag">Home Court</span>}
          <div className="t2-teamboard-name-text">{team.name}</div>
          {statusLabel && <div className="t2-teamboard-status">{statusLabel}</div>}
        </div>
        <div className="t2-teamboard-matchup">
          {chipSlots(matchupCards, 3).map((c, i) => <MatchupSlot key={i} card={c} />)}
        </div>
      </div>
      <div className="t2-teamboard-roster">
        <div className="t2-teamboard-group">
          <span className="t2-teamboard-row-label">Starters</span>
          <div className="t2-teamboard-slots">{chipSlots(starters, 5).map((c, i) => <PlayerSlot key={i} card={c} />)}</div>
        </div>
        <div className="t2-teamboard-group">
          <span className="t2-teamboard-row-label">Bench</span>
          <div className="t2-teamboard-slots">{chipSlots(bench, 4).map((c, i) => <PlayerSlot key={i} card={c} />)}</div>
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
export default function TurnPanel({ state, actions, m, myTeamId }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [targetPickerCardId, setTargetPickerCardId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(CARD_TIMER_SECONDS);
  const [coinSpinning, setCoinSpinning] = useState(false);
  const coinTimerRef = useRef(null);
  const [rollPhase, setRollPhase] = useState('both');
  const rollTimersRef = useRef([]);

  const cur = turn.current;
  const actingTeam = cur ? (cur.team === 'a' ? teamA : teamB) : null;
  const offenseTeam = turn.offenseSide ? (turn.offenseSide === 'a' ? teamA : teamB) : null;
  const defenseTeam = turn.defenseSide ? (turn.defenseSide === 'a' ? teamA : teamB) : null;
  // Possession is decided the instant the coin lands (turn.order[0]) — offenseSide isn't set
  // until startExchange runs one stage later, so the header/result badge fall back to the
  // coin-flip winner directly instead of showing blank between 'coinflipped' and 'card'.
  const possessionTeam = offenseTeam || (turn.order ? turn.order[0] : null);

  const myTurnToAct = turn.stage === 'card' && humanInMatch && actingTeam === myTeam;
  // Only a live human opponent (online play) has nothing to prompt here — an AI's card choice
  // still needs this client to call advanceTurn() to actually process it, so that case falls
  // through to the generic Advance button instead of stalling on a wait message.
  const waitingOnOpponent = turn.stage === 'card' && humanInMatch && actingTeam !== myTeam && actingTeam.human;

  const advance = (payload) => actions.advanceTurn(payload);

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

  // Both dice are already resolved the instant turn.stage becomes 'resolved' — this just
  // plays that result back as a little sequence (pulse offense, reveal it, pulse defense,
  // reveal it, show both) before auto-advancing, so there's never a Continue click for a roll.
  useEffect(() => {
    rollTimersRef.current.forEach(clearTimeout);
    rollTimersRef.current = [];
    if (turn.stage !== 'resolved') return undefined;
    setRollPhase('pulse-off');
    const schedule = (fn, delay) => { rollTimersRef.current.push(setTimeout(fn, delay)); };
    schedule(() => setRollPhase('reveal-off'), ROLL_PULSE_MS);
    schedule(() => setRollPhase('pulse-def'), ROLL_PULSE_MS + ROLL_REVEAL_MS);
    schedule(() => setRollPhase('reveal-def'), ROLL_PULSE_MS * 2 + ROLL_REVEAL_MS);
    schedule(() => setRollPhase('both'), ROLL_PULSE_MS * 2 + ROLL_REVEAL_MS * 2);
    schedule(() => advance(), ROLL_PULSE_MS * 2 + ROLL_REVEAL_MS * 2 + ROLL_BOTH_READ_MS);
    return () => rollTimersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.stage, turn.exchangeIndex]);

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

  // Blind by convention: never surface an in-progress exchange's card-play log entries — only
  // entries from an already-resolved exchange (or the finished match) are shown, so a human
  // waiting on their own pick can't read what the opponent just locked in.
  const visibleLog = turn.log.filter((e) => e.stepIndex < turn.exchangeIndex || turn.stage === 'resolved' || turn.stage === 'bench');

  const advanceLabel = turn.stage === 'bench' ? 'Finish Turn' : 'Continue';
  // Neither coin-flip stage nor a resolving roll needs a footer button — the ball mark starts
  // the flip, and both the tip result and the roll sequence auto-advance on their own.
  const showGenericAdvance = turn.stage !== 'coinflip' && turn.stage !== 'coinflipped' && turn.stage !== 'resolved'
    && ((turn.stage !== 'card') || (!myTurnToAct && !waitingOnOpponent));

  const statusFor = (side) => {
    const team = side === 'a' ? teamA : teamB;
    if (turn.stage === 'coinflip') return '';
    if (turn.stage === 'bench') return 'Bench · No Cards';
    if (turn.stage === 'resolved') {
      if (offenseTeam === team) {
        return rollPhase === 'pulse-off' ? 'On Offense' : `Offense Roll — ${turn[`${side}OffDie`]}`;
      }
      if (defenseTeam === team) {
        return (rollPhase === 'reveal-def' || rollPhase === 'both') ? `Defense Roll — ${turn[`${side}DefDie`]}` : 'On Defense';
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
              <BallMark size={90} variant="onInk" />
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
      const sides = cur.role === 'offense' ? offenseDieSize(actingTeam) : defenseDieSize(actingTeam);
      return (
        <div className="t2-rollzone-die">
          <div className="t2-die-stage"><Die sides={sides} value={sides} size={100} pulsing /></div>
        </div>
      );
    }
    if (turn.stage === 'resolved') {
      const offSide = turn.offenseSide, defSide = turn.defenseSide;
      const offTeam = offSide === 'a' ? teamA : teamB;
      const defTeam = defSide === 'a' ? teamA : teamB;
      const offDie = turn[`${offSide}OffDie`], offSides = turn[`${offSide}OffSides`];
      const defDie = turn[`${defSide}DefDie`], defSides = turn[`${defSide}DefSides`];

      if (rollPhase === 'pulse-off') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={offSides} value={offSides} size={100} pulsing /></div>
            <div className="t2-rollzone-caption">{offTeam.name} Rolls For Offense</div>
          </div>
        );
      }
      if (rollPhase === 'reveal-off') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={offSides} value={offDie} size={100} /></div>
            <div className="t2-rollzone-caption t2-fade-in">{offTeam.name} Rolls {offDie}</div>
          </div>
        );
      }
      if (rollPhase === 'pulse-def') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={defSides} value={defSides} size={100} pulsing /></div>
            <div className="t2-rollzone-caption">{defTeam.name} Rolls For Defense</div>
          </div>
        );
      }
      if (rollPhase === 'reveal-def') {
        return (
          <div className="t2-rollzone-die">
            <div className="t2-die-stage"><Die sides={defSides} value={defDie} size={100} /></div>
            <div className="t2-rollzone-caption t2-fade-in">{defTeam.name} Rolls {defDie}</div>
          </div>
        );
      }
      return (
        <div className="t2-rollzone-dual t2-fade-in">
          <div className="t2-rollzone-die"><div className="t2-die-stage"><Die sides={offSides} value={offDie} size={92} /></div><div className="t2-rollzone-caption">Offense<br /><span>{offTeam.name}</span></div></div>
          <div className="t2-rollzone-die"><div className="t2-die-stage"><Die sides={defSides} value={defDie} size={92} /></div><div className="t2-rollzone-caption">Defense<br /><span>{defTeam.name}</span></div></div>
        </div>
      );
    }
    return (
      <div className="t2-rollzone-coin">
        <div className="t2-coin"><div className="t2-coin-face">🪑</div><div className="t2-coin-brand">Nine Deep</div></div>
        <div className="t2-rollzone-caption">Bench<br /><span>Resolves straight from each roster</span></div>
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

            {turn.stage === 'bench' && (
              <div className="t2-report">
                <div className="t2-report-row"><span className="t2-report-label">{teamA.name} Bench</span><span>+{turn.aBench}</span></div>
                <div className="t2-report-row"><span className="t2-report-label">{teamB.name} Bench</span><span>+{turn.bBench}</span></div>
              </div>
            )}
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
              <div key={i} className="t2-log-entry">
                <span className="t2-log-entry-tag">{n.tag}</span>
                {n.text}
              </div>
            ))}
          </div>
          <div className="t2-log-footer">Every roll is filed. The log is the receipt a season recap is built from.</div>
        </div>
      </div>
    </div>
  );
}
