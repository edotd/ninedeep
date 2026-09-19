import { useEffect, useRef, useState } from 'react';
import { playableCards } from '../game/matchup';
import { PLAYER_STATS, eligibleStatTargets } from '../game/supplementalEffects';

// Decision clock for a blind matchup-card choice — long enough to read your hand, short
// enough to put real pressure on the pick. Auto-passes on timeout so a stalled player can't
// freeze the match for their opponent.
const CARD_TIMER_SECONDS = 8;

// Drives one turn (coin flip, then two offense/defense exchanges) stage by stage — see
// game/turn.js for the state machine this renders. Stays mounted until m.turn.stage becomes
// 'complete', at which point m.result exists and PlayoffSeriesScreen swaps back to the
// existing MatchupBox reveal.
export default function TurnPanel({ state, actions, m, myTeamId }) {
  const turn = m.turn;
  const teamA = m.a, teamB = m.b;
  const myTeam = state.teams[myTeamId];
  const humanInMatch = teamA === myTeam || teamB === myTeam;
  const [targetPickerCardId, setTargetPickerCardId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(CARD_TIMER_SECONDS);

  const cur = turn.current;
  const actingTeam = cur ? (cur.team === 'a' ? teamA : teamB) : null;
  const offenseTeam = turn.offenseSide ? (turn.offenseSide === 'a' ? teamA : teamB) : null;
  const defenseTeam = turn.defenseSide ? (turn.defenseSide === 'a' ? teamA : teamB) : null;

  const myTurnToAct = turn.stage === 'card' && humanInMatch && actingTeam === myTeam;
  // Only a live human opponent (online play) has nothing to prompt here — an AI's card choice
  // still needs this client to call advanceTurn() to actually process it, so that case falls
  // through to the generic Continue button below instead of stalling on a wait message.
  const waitingOnOpponent = turn.stage === 'card' && humanInMatch && actingTeam !== myTeam && actingTeam.human;

  const advance = (payload) => actions.advanceTurn(payload);

  // Close any open target picker the moment the acting step moves on — otherwise a picker
  // left open from a card whose window already timed out reappears on a later exchange, since
  // playableCards can return the same still-unused card by the same id.
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

  // Blind by convention: never surface an in-progress exchange's card-play log entries to the
  // UI — only entries from an already-resolved exchange (or the finished match) are shown, so
  // a human waiting on their own pick can't read what the opponent just locked in.
  const visibleLog = turn.log.filter((e) => e.stepIndex < turn.exchangeIndex || turn.stage === 'resolved');

  const headline = turn.stage === 'coinflip'
    ? 'Coin Flip'
    : turn.stage === 'card'
      ? `Exchange ${turn.exchangeIndex + 1} — ${offenseTeam.name} On Offense`
      : `Exchange ${turn.exchangeIndex + 1} Result`;

  return (
    <div className="turn-screen">
      <div className="turn-matchup-title">{m.label}</div>
      <div className="turn-heading">{teamA.name} vs {teamB.name}</div>

      <div className="turn-rail">
        <div className={`turn-rail-item ${turn.order ? 'filed' : 'active'}`}>Coin Flip</div>
        <div className={`turn-rail-item ${turn.exchangeIndex > 0 ? 'filed' : turn.order ? 'active' : 'pending'}`}>Exchange 1</div>
        <div className={`turn-rail-item ${turn.exchangeIndex === 1 ? 'active' : turn.exchangeIndex > 1 ? 'filed' : 'pending'}`}>Exchange 2</div>
      </div>

      <div className="turn-stage-panel">
        <div className="turn-stage-headline">{headline}</div>

        {turn.stage === 'coinflip' && (
          <div className="turn-coin-row">
            <div className="turn-coin">
              <div className="turn-coin-face">Toss</div>
              <div className="turn-coin-brand">Nine Deep</div>
            </div>
            <div className="turn-coin-sub">Winner opens on offense for Exchange 1; roles flip for Exchange 2, so both teams get one offense possession and one defense possession.</div>
          </div>
        )}

        {turn.stage === 'card' && (
          <div className="turn-stage-sub">
            {offenseTeam.name} is on offense, {defenseTeam.name} is on defense this exchange. Both teams lock in a matchup card — or pass — blind, before either die is rolled.
          </div>
        )}

        {myTurnToAct && (
          <>
            <div className={'turn-timer' + (timeLeft <= 3 ? ' urgent' : '')}>{Math.ceil(timeLeft)}s to decide</div>
            {myOptions.length === 0 && <div className="turn-waiting">No card to play this possession.</div>}
            {myOptions.map((c) => {
              const isPicking = targetPickerCardId === c.id;
              const targetTeam = c.target === 'self' ? myTeam : (actingTeam === teamA ? teamB : teamA);
              const targetIds = targetTeam === teamA ? turn.idsA : turn.idsB;
              const targetPlayers = eligibleStatTargets(targetTeam, targetIds, c);
              return (
                <div key={c.id}>
                  <button
                    className="turn-action-btn"
                    disabled={c.targetsPlayer && targetPlayers.length === 0}
                    onClick={() => {
                      if (c.targetsPlayer) { setTargetPickerCardId(isPicking ? null : c.id); return; }
                      advance({ cardId: c.id });
                    }}
                  >
                    <span className="turn-action-name">{c.name}{c.rarity ? ` · ${c.rarity}` : ''}</span>
                    {c.description && <span>{c.description} · </span>}
                    {c.targetsPlayer && targetPlayers.length === 0 && <span>No eligible starter · </span>}
                    {c.targetsPlayer ? `Choose a target on ${targetTeam.name}` : `Play on ${targetTeam.name}`}
                  </button>
                  {isPicking && (
                    <div style={{ marginBottom: 8 }}>
                      {targetPlayers.flatMap((oc) => (c.targetsPlayer && c.effectType ? PLAYER_STATS : [null]).map((stat) => (
                        <button
                          key={`${oc.id}-${stat}`}
                          className="turn-action-btn"
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
            <button className="turn-pass-btn" onClick={() => advance({ pass: true })}>Pass</button>
          </>
        )}

        {waitingOnOpponent && (
          <div className="turn-waiting">Waiting on {actingTeam.name} to lock in a card…</div>
        )}
        {turn.stage === 'card' && !myTurnToAct && !waitingOnOpponent && !actingTeam.human && (
          <div className="turn-waiting">{actingTeam.name} is locking in a card.</div>
        )}

        {turn.stage === 'resolved' && (() => {
          const offSide = turn.offenseSide, defSide = turn.defenseSide;
          const offTeam = offSide === 'a' ? teamA : teamB;
          const defTeam = defSide === 'a' ? teamA : teamB;
          const offDie = turn[`${offSide}OffDie`], offSides = turn[`${offSide}OffSides`], offTotal = turn[`${offSide}OffTotal`], offWon = turn[`${offSide}OffWon`];
          const defDie = turn[`${defSide}DefDie`], defSides = turn[`${defSide}DefSides`], defTotal = turn[`${defSide}DefTotal`];
          return (
            <div className="turn-report">
              <div className="turn-report-row"><span className="turn-report-label">{offTeam.name} rolls (Offense)</span><span>{offDie} / 1d{offSides}</span></div>
              <div className="turn-report-row"><span className="turn-report-label">{defTeam.name} rolls (Defense)</span><span>{defDie} / 1d{defSides}</span></div>
              <div className="turn-report-row"><span className="turn-report-label">Possession</span><span>{offWon ? `${offTeam.name} wins` : `${defTeam.name} wins`}</span></div>
              <div className="turn-report-row"><span className="turn-report-label">{offTeam.name} Offense</span><span>+{offTotal}{!offWon ? ' (reduced)' : ''}</span></div>
              <div className="turn-report-row"><span className="turn-report-label">{defTeam.name} Defense</span><span>+{defTotal}</span></div>
              {turn.log.filter((e) => e.stepIndex === turn.exchangeIndex && e.tag !== 'pregame').slice().reverse().map((e, i) => (
                <div key={i} className="turn-outcome-strip" style={{ fontSize: 13, padding: '8px 10px' }}>{e.text}</div>
              ))}
            </div>
          );
        })()}

        {turn.stage === 'coinflip' && (
          <button className="turn-primary-btn" onClick={() => advance()}>Flip Coin</button>
        )}
        {turn.stage === 'card' && !myTurnToAct && !waitingOnOpponent && (
          <button className="turn-primary-btn" onClick={() => advance()}>Continue</button>
        )}
        {turn.stage === 'resolved' && (
          <button className="turn-primary-btn" onClick={() => advance()}>Continue</button>
        )}
      </div>

      {visibleLog.length > 0 && (
        <div className="turn-log">
          <div className="turn-log-header">Game Log</div>
          {visibleLog.map((n, i) => (
            <div key={i} className={`turn-log-entry tag-${n.tag}`}>{n.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
