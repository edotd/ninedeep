import { useEffect, useRef, useState } from 'react';
import { playerGrade } from '../game/cards';
import { formatCoins, remainingCap, spendableRoom } from '../game/economy';
import { negotiationBand, negotiationAcceptThreshold, negotiationAcceptChance, MAX_NEGOTIATION_ROLLS, SALARY_STEP } from '../game/negotiation';
import { MAX_CONTRACT_YEARS, toBudget } from '../game/constants';
import DieFaceStrip from './DieFaceStrip';
import Die, { ROLL_DURATION_MS } from './Die';

// How long the landed die stays up before the outcome replaces it.
const SETTLE_HOLD_MS = 800;

// Game 1, "Re-signing" — a full-screen takeover over the Contracts file, per the design
// handoff. One negotiation session per card (state.offseason.negotiations[card.id]), driven
// entirely by the shared negotiation.js reducer; this component only ever reflects that state
// back and forwards button clicks into it.
export default function NegotiationModal({ state, actions, myTeamId, card, onClose }) {
  const team = state.teams[myTeamId];
  const session = state.offseason?.negotiations?.[card.id];
  const [offer, setOffer] = useState(() => (session ? session.offer : { salary: card.salary, years: card.maxContract }));
  const [editingCounter, setEditingCounter] = useState(false);
  const [error, setError] = useState(null);
  // Which term the arrows change: the cost per year first, then the years.
  const [selected, setSelected] = useState('salary');
  // The roll itself: 'waiting' for the result to land in state, 'rolling' while the die spins,
  // 'landed' while it rests on its number before the outcome replaces the offer view.
  const [rollPhase, setRollPhase] = useState(null);
  const [rollValue, setRollValue] = useState(null);
  const rollsSeen = useRef(session ? session.history.length : 0);
  const rollTimers = useRef([]);
  useEffect(() => () => rollTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (rollPhase !== 'waiting' || !session) return;
    if (session.history.length <= rollsSeen.current) return;
    rollsSeen.current = session.history.length;
    setRollValue(session.history.at(-1).roll);
    setRollPhase('rolling');
    rollTimers.current.push(setTimeout(() => setRollPhase('landed'), ROLL_DURATION_MS));
    rollTimers.current.push(setTimeout(() => setRollPhase(null), ROLL_DURATION_MS + SETTLE_HOLD_MS));
  }, [rollPhase, session?.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Not while the die is rolling — the offer on screen has to stay the one being rolled.
    if (!session || rollPhase) return;
    setOffer(session.pendingCounter && !editingCounter ? session.pendingCounter : session.offer);
  }, [session?.rollsUsed, session?.status, rollPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const band = negotiationBand(session.askSalary, session.askYears, offer.salary, offer.years);
  const threshold = negotiationAcceptThreshold(band);
  const chance = negotiationAcceptChance(band);
  const walkFaces = band === 'Lowball' ? [1, 2] : [];
  const lastRoll = session.history.at(-1);
  const floor = session.pendingCounter ? session.offer : { salary: session.minSalary, years: 1 };
  const rollsLeft = MAX_NEGOTIATION_ROLLS - session.rollsUsed;
  const rolling = rollPhase !== null;
  const showCounterView = !rolling && session.status === 'active' && Boolean(session.pendingCounter) && !editingCounter;
  const showOfferView = rolling || (session.status === 'active' && !showCounterView);

  const bumpSalary = (delta) => setOffer((o) => ({ ...o, salary: Math.max(session.minSalary, Math.min(session.askSalary + toBudget(4), Math.round(o.salary + delta))) }));
  const bumpYears = (delta) => setOffer((o) => ({ ...o, years: Math.max(floor.years, Math.min(MAX_CONTRACT_YEARS, o.years + delta)) }));
  const nudge = (dir) => (selected === 'salary' ? bumpSalary(dir * SALARY_STEP) : bumpYears(dir));
  const atMin = selected === 'salary' ? offer.salary <= floor.salary : offer.years <= floor.years;
  const atMax = selected === 'salary' ? offer.salary >= session.askSalary + toBudget(4) : offer.years >= MAX_CONTRACT_YEARS;

  const doRoll = () => {
    setError(null);
    rollsSeen.current = session.history.length;
    const res = actions.submitNegotiationOffer(myTeamId, card.id, offer.salary, offer.years);
    if (res && res.ok === false) { setError(res.msg); return; }
    setEditingCounter(false);
    setRollPhase('waiting');
    // If the result never arrives (a failed write), give the controls back.
    rollTimers.current.push(setTimeout(() => setRollPhase((p) => (p === 'waiting' ? null : p)), 6000));
  };
  const doAccept = () => {
    setError(null);
    const res = actions.acceptNegotiationCounter(myTeamId, card.id);
    if (res && res.ok === false) setError(res.msg);
  };
  const doWalk = () => actions.walkAwayFromNegotiation(myTeamId, card.id);

  return (
    <div className="tsx-overlay">
      <div className="neg-panel">
        <div className="neg-head">
          <button type="button" className="neg-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="neg-head-title">RE-SIGN{session.rollsUsed > 0 && session.status === 'active' ? ` · ROLL ${session.rollsUsed} OF ${MAX_NEGOTIATION_ROLLS}` : ''}</div>
          <div className="neg-rolls-pips">
            {Array.from({ length: MAX_NEGOTIATION_ROLLS }, (_, i) => (
              <div key={i} className={'neg-pip' + (i < session.rollsUsed ? ' used' : '')} />
            ))}
          </div>
        </div>

        <div className="neg-player">
          <span className="neg-jersey">{playerGrade(card)}</span>
          <div>
            <div className="neg-player-tags">{card.tierName} · {card.position}</div>
            <div className="neg-player-name">{card.archetype}</div>
          </div>
        </div>

        {showCounterView && (
          <>
            <div className="neg-ask-row">
              <div><span className="neg-microlabel">Agent Asks</span><div className="neg-figure">{formatCoins(session.askSalary)} × {session.askYears} yrs</div></div>
              <div><span className="neg-microlabel">Cap Room</span><div className="neg-figure">{formatCoins(remainingCap(team))}</div></div>
            </div>
            <div className="neg-counter-block">
              <div className="neg-microlabel">Agent Counters</div>
              <div className="neg-counter-terms">{formatCoins(session.pendingCounter.salary)} × {session.pendingCounter.years} yrs</div>
              <p className="neg-note">
                {spendableRoom(team) >= session.pendingCounter.salary
                  ? `No roll needed. Accepting leaves room ${formatCoins(remainingCap(team) - session.pendingCounter.salary)}.`
                  : `${formatCoins(session.pendingCounter.salary - spendableRoom(team))} over your cap — clear room first or let him walk.`}
              </p>
              {session.pendingCounter.final && <p className="neg-note">Final counter · no rolls left.</p>}
              <div className="neg-actions">
                <button type="button" className="primary" disabled={spendableRoom(team) < session.pendingCounter.salary} onClick={doAccept}>Accept Counter</button>
                {!session.pendingCounter.final && (
                  <button type="button" className="secondary" onClick={() => setEditingCounter(true)}>Improve Offer</button>
                )}
                <button type="button" className="neg-walk-link" onClick={doWalk}>Let Him Walk</button>
              </div>
            </div>
          </>
        )}

        {showOfferView && (
          <>
            <div className="neg-cols">
              <div className="neg-col ask">
                <span className="neg-col-title">Agent&rsquo;s Ask</span>
                <div className="neg-field"><span className="neg-arrow ghost" aria-hidden="true">◀</span><div className="neg-field-body"><small>Cost / Year</small><b>{formatCoins(session.askSalary)}</b></div><span className="neg-arrow ghost" aria-hidden="true">▶</span></div>
                <div className="neg-field"><span className="neg-arrow ghost" aria-hidden="true">◀</span><div className="neg-field-body"><small>Years</small><b>{session.askYears}</b></div><span className="neg-arrow ghost" aria-hidden="true">▶</span></div>
              </div>
              <div className="neg-col offer">
                <span className="neg-col-title">Your Offer</span>
                {[['salary', 'Cost / Year', formatCoins(offer.salary)], ['years', 'Years', offer.years]].map(([key, label, value]) => (
                  <div className={'neg-field' + (selected === key ? ' selected' : '')} key={key}>
                    <button type="button" className="neg-arrow" aria-label={`Lower ${label}`} disabled={rolling || selected !== key || atMin} onClick={() => nudge(-1)}>◀</button>
                    <button type="button" className="neg-field-body" aria-pressed={selected === key} onClick={() => setSelected(key)}><small>{label}</small><b>{value}</b></button>
                    <button type="button" className="neg-arrow" aria-label={`Raise ${label}`} disabled={rolling || selected !== key || atMax} onClick={() => nudge(1)}>▶</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="neg-room-line"><span>Cap Room</span><b>{formatCoins(remainingCap(team))}</b>{floor.salary > session.minSalary && <span className="neg-was">· was {formatCoins(floor.salary)} × {floor.years} yrs</span>}</div>
            <div className="neg-band-row">
              <div className="neg-band-name">{band.toUpperCase()}</div>
              <div className="neg-band-chance">{chance}% <span>TO SIGN</span></div>
            </div>
            <DieFaceStrip threshold={threshold} walkFaces={walkFaces} rolled={rollPhase === 'landed' ? rollValue : undefined} />
            <div className="neg-band-split">
              {walkFaces.length > 0 && <span className="walk">1–2 WALKS</span>}
              <span className="counter">{walkFaces.length ? '3' : '1'}–{threshold - 1} AGENT COUNTERS</span>
              <span className="sign">{threshold}–10 SIGNS</span>
            </div>
            {error && <div className="neg-error">{error}</div>}
            <button
              type="button"
              className={'neg-die-btn' + (rolling ? ' busy' : '')}
              aria-label={session.rollsUsed === 0 && !rolling ? 'Roll the D10' : 'Roll again'}
              disabled={rolling || rollsLeft <= 0 || (offer.salary === floor.salary && offer.years === floor.years && Boolean(session.pendingCounter))}
              onClick={doRoll}
            >
              <Die sides={10} value={rollValue ?? lastRoll?.roll ?? 10} size={92} rolling={rollPhase === 'rolling'} prompt={!rolling ? 'Roll' : null} />
              <span className="neg-die-caption">{rolling ? 'Rolling…' : session.rollsUsed === 0 ? 'Tap the die to roll the D10' : `Tap to roll again · ${rollsLeft} left`}</span>
            </button>
            {session.pendingCounter && offer.salary === floor.salary && offer.years === floor.years && !rolling && (
              <div className="neg-note">Raise at least one term to roll again.</div>
            )}
          </>
        )}

        {!rolling && session.status === 'signed' && (
          <div className="neg-result signed">
            <div className="neg-stamp signed">SIGNED</div>
            <div className="neg-figure big">{formatCoins(session.offer.salary)} × {session.offer.years} yrs</div>
            <p className="neg-note">
              {lastRoll ? `Signed on roll ${session.rollsUsed} · rolled ${lastRoll.roll}, needed ${lastRoll.threshold}.` : 'Signed without a roll.'}
            </p>
            <button type="button" className="primary" onClick={onClose}>Back to Contracts</button>
          </div>
        )}

        {!rolling && session.status === 'walked' && (
          <div className="neg-result walked">
            <div className="neg-stamp walked">{card.archetype} Heads To The Pool</div>
            <p className="neg-note">
              {lastRoll?.result === 'walks'
                ? 'A lowball offer missed on 1 or 2 and ended the talks. You can still bid on him in free agency.'
                : 'Talks ended. You can still bid on him in free agency.'}
            </p>
            <button type="button" className="primary" onClick={onClose}>Back to Contracts</button>
          </div>
        )}
      </div>
    </div>
  );
}
