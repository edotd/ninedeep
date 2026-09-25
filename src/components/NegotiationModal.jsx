import { useEffect, useState } from 'react';
import { jerseyNumber } from '../game/cards';
import { formatCoins, remainingCap } from '../game/economy';
import { negotiationBand, negotiationAcceptThreshold, negotiationAcceptChance, MAX_NEGOTIATION_ROLLS } from '../game/negotiation';
import DieFaceStrip from './DieFaceStrip';

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

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

  useEffect(() => {
    if (!session) return;
    setOffer(session.pendingCounter && !editingCounter ? session.pendingCounter : session.offer);
  }, [session?.rollsUsed, session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const band = negotiationBand(session.askSalary, session.askYears, offer.salary, offer.years);
  const threshold = negotiationAcceptThreshold(band);
  const chance = negotiationAcceptChance(band);
  const walkFaces = band === 'Lowball' ? [1, 2] : [];
  const lastRoll = session.history.at(-1);
  const floor = session.pendingCounter ? session.offer : { salary: session.minSalary, years: 1 };
  const rollsLeft = MAX_NEGOTIATION_ROLLS - session.rollsUsed;

  const bumpSalary = (delta) => setOffer((o) => ({ ...o, salary: Math.max(session.minSalary, Math.min(session.askSalary + 4, Math.round((o.salary + delta) * 2) / 2)) }));
  const setYears = (y) => setOffer((o) => ({ ...o, years: y }));

  const doRoll = () => {
    setError(null);
    const res = actions.submitNegotiationOffer(myTeamId, card.id, offer.salary, offer.years);
    if (res && res.ok === false) setError(res.msg);
    else setEditingCounter(false);
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
          <span className="neg-jersey">#{jerseyNumber(card)}</span>
          <div>
            <div className="neg-player-tags">{card.tierName} · {card.position}</div>
            <div className="neg-player-name">{card.archetype}</div>
          </div>
        </div>

        {session.status === 'active' && (
          <>
            <div className="neg-ask-row">
              <div><span className="neg-microlabel">Agent Asks</span><div className="neg-figure">{formatCoins(session.askSalary)} × {session.askYears} yrs</div></div>
              <div><span className="neg-microlabel">Cap Room</span><div className="neg-figure">{formatCoins(remainingCap(team))}</div></div>
            </div>

            {session.pendingCounter && !editingCounter ? (
              <div className="neg-counter-block">
                <div className="neg-microlabel">Agent Counters</div>
                <div className="neg-counter-terms">{formatCoins(session.pendingCounter.salary)} × {session.pendingCounter.years} yrs</div>
                <p className="neg-note">
                  {remainingCap(team) >= session.pendingCounter.salary
                    ? `No roll needed. Accepting leaves room ${formatCoins(remainingCap(team) - session.pendingCounter.salary)}.`
                    : `${formatCoins(session.pendingCounter.salary - remainingCap(team))} over your cap — clear room first or let him walk.`}
                </p>
                {session.pendingCounter.final && <p className="neg-note">Final counter · no rolls left.</p>}
                <div className="neg-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={remainingCap(team) < session.pendingCounter.salary}
                    onClick={doAccept}
                  >
                    Accept Counter
                  </button>
                  {!session.pendingCounter.final && (
                    <button type="button" className="secondary" onClick={() => setEditingCounter(true)}>Improve Offer</button>
                  )}
                  <button type="button" className="neg-walk-link" onClick={doWalk}>Let Him Walk</button>
                </div>
              </div>
            ) : (
              <>
                <div className="neg-stepper-row">
                  <span className="neg-microlabel">Salary / Season{floor.salary > session.minSalary ? ` · was ${formatCoins(floor.salary)}` : ''}</span>
                  <div className="neg-stepper">
                    <button type="button" onClick={() => bumpSalary(-0.5)} disabled={offer.salary <= floor.salary}>−</button>
                    <span>{formatCoins(offer.salary)}</span>
                    <button type="button" onClick={() => bumpSalary(0.5)}>+</button>
                  </div>
                </div>
                <div className="neg-years-row">
                  <span className="neg-microlabel">Years</span>
                  <div className="neg-years-options">
                    {YEAR_OPTIONS.map((y) => (
                      <button key={y} type="button" className={'neg-year-opt' + (offer.years === y ? ' selected' : '')} disabled={y < floor.years} onClick={() => setYears(y)}>{y}</button>
                    ))}
                  </div>
                </div>
                <div className="neg-band-row">
                  <div className="neg-band-name">{band.toUpperCase()}</div>
                  <div className="neg-band-chance">{chance}% <span>TO SIGN</span></div>
                </div>
                <DieFaceStrip threshold={threshold} walkFaces={walkFaces} />
                <div className="neg-band-split">
                  {walkFaces.length > 0 && <span className="walk">1–2 WALKS</span>}
                  <span className="counter">{walkFaces.length ? '3' : '1'}–{threshold - 1} AGENT COUNTERS</span>
                  <span className="sign">{threshold}–10 SIGNS</span>
                </div>
                {error && <div className="neg-error">{error}</div>}
                <button
                  type="button"
                  className="primary neg-roll-btn"
                  disabled={rollsLeft <= 0 || (offer.salary === floor.salary && offer.years === floor.years && session.pendingCounter)}
                  onClick={doRoll}
                >
                  {session.rollsUsed === 0 ? 'Roll the D10' : `Roll Again · ${rollsLeft} Left`}
                </button>
                {session.pendingCounter && offer.salary === floor.salary && offer.years === floor.years && (
                  <div className="neg-note">Raise at least one term to roll again.</div>
                )}
              </>
            )}
          </>
        )}

        {session.status === 'signed' && (
          <div className="neg-result signed">
            <div className="neg-stamp signed">SIGNED</div>
            <div className="neg-figure big">{formatCoins(session.offer.salary)} × {session.offer.years} yrs</div>
            <p className="neg-note">
              {lastRoll ? `Signed on roll ${session.rollsUsed} · rolled ${lastRoll.roll}, needed ${lastRoll.threshold}.` : 'Signed without a roll.'}
            </p>
            <button type="button" className="primary" onClick={onClose}>Back to Contracts</button>
          </div>
        )}

        {session.status === 'walked' && (
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
