import { useState } from 'react';
import { jerseyNumber } from '../game/cards';
import { formatCoins, remainingCap } from '../game/economy';
import { freeAgentPriority, pendingFaHoldTotal, winningValue } from '../game/bidding';

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const BONUS_LABEL = {
  Salary: (min, tier) => `${formatCoins(min + tier * 0.5)}${tier === 3 ? '+' : ''}`,
  Contract: (min, tier) => `${min + tier}${tier === 3 ? '+' : ''} yr${min + tier === 1 ? '' : 's'}`,
  Winning: (min, tier) => ['Missed playoffs', 'Made playoffs', 'Conference finals', 'Won it all'][tier],
};

// Game 2, "Free-agent bidding" — a full-screen takeover over the Free Agency pool. Every
// team's whole position lives in state.offseason.bidding[card.id] (see bidding.js); this
// component only ever renders that shared session and forwards clicks into its actions.
export default function BiddingModal({ state, actions, myTeamId, card, onClose, market = 'freeagency' }) {
  const team = state.teams[myTeamId];
  const session = state.offseason?.bidding?.[card.id];
  const myBid = session?.bids?.[team.id];
  const minSalary = session?.minSalary ?? card.salary;
  const minYears = session?.minYears ?? card.contract;
  const priority = session?.priority ?? freeAgentPriority(card);
  const [offer, setOffer] = useState({ salary: myBid?.salary ?? minSalary, years: myBid?.years ?? minYears });
  const [error, setError] = useState(null);

  const floor = myBid ? { salary: myBid.salary, years: myBid.years } : { salary: minSalary, years: minYears };
  const room = remainingCap(team) - pendingFaHoldTotal(state, team, card.id);

  const bumpSalary = (delta) => setOffer((o) => ({ ...o, salary: Math.max(floor.salary, Math.round((o.salary + delta) * 2) / 2) }));
  const setYears = (y) => setOffer((o) => ({ ...o, years: y }));

  const submitOpen = () => {
    setError(null);
    const res = actions.openFreeAgentBid(myTeamId, card.id, offer.salary, offer.years, market);
    if (res && res.ok === false) setError(res.msg);
  };
  const submitRaise = () => {
    setError(null);
    const res = actions.raiseFreeAgentBid(myTeamId, card.id, offer.salary, offer.years);
    if (res && res.ok === false) setError(res.msg);
  };
  const standPat = () => actions.standPatFreeAgentBid(myTeamId, card.id);

  const resolved = session?.status === 'resolved';
  const result = session?.result;

  return (
    <div className="tsx-overlay">
      <div className="neg-panel bid-panel">
        <div className="neg-head">
          <button type="button" className="neg-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="neg-head-title">{market === 'contracts' ? 'EXPIRING CONTRACTS' : 'FREE AGENCY'}{resolved ? ' · CLOSED' : ''}</div>
        </div>

        <div className="neg-player">
          <span className="neg-jersey">#{jerseyNumber(card)}</span>
          <div>
            <div className="neg-player-tags">{card.tierName} · {card.position}</div>
            <div className="neg-player-name">{card.archetype}</div>
          </div>
        </div>

        {!resolved && (
          <div className="bid-priority-row">
            <span className="neg-microlabel">Rolls For {priority || '—'}</span>
            <span className="bid-minimum">Minimum {formatCoins(minSalary)} × {minYears} yrs</span>
          </div>
        )}

        {!resolved && session && Object.keys(session.bids || {}).length > 0 && (
          <div className="bid-board">
            <div className="bid-board-head"><span>Team</span><span>Salary</span><span>Yrs</span><span>Value</span><span>Status</span></div>
            {Object.entries(session.bids).map(([tid, bid]) => {
              const bidder = state.teams.find((candidate) => candidate.id === Number(tid));
              const mine = Number(tid) === team.id;
              return (
                <div key={tid} className="bid-board-row">
                  <span>{bidder?.name}{mine ? ' · You' : ''}</span>
                  <span>{mine ? formatCoins(bid.salary) : 'Private'}</span>
                  <span>{mine ? bid.years : '—'}</span>
                  <span>{mine ? (priority === 'Winning' ? winningValue(team) : `+${bid.bonus}`) : '—'}</span>
                  <span>{bid.stage === 'final' ? 'Final offer' : 'Offer made'}</span>
                </div>
              );
            })}
          </div>
        )}

        {!resolved && !myBid && (
          <>
            {priority === 'Winning' ? (
              <div className="neg-note">Winning value: {winningValue(team)} · current projected output{team.seasonHistory?.length ? ' plus your prior-season finish' : ''}.</div>
            ) : (
              <div className="bid-bonus-table">
                {[0, 1, 2, 3].map((tier) => (
                  <div key={tier} className="bid-bonus-row"><span>+{tier}</span><span>{BONUS_LABEL[priority](priority === 'Contract' ? minYears : minSalary, tier)}</span></div>
                ))}
              </div>
            )}
            <div className="neg-stepper-row">
              <span className="neg-microlabel">Salary / Season</span>
              <div className="neg-stepper">
                <button type="button" onClick={() => bumpSalary(-0.5)} disabled={offer.salary <= minSalary}>−</button>
                <span>{formatCoins(offer.salary)}</span>
                <button type="button" onClick={() => bumpSalary(0.5)}>+</button>
              </div>
            </div>
            <div className="neg-years-row">
              <span className="neg-microlabel">Years</span>
              <div className="neg-years-options">
                {YEAR_OPTIONS.map((y) => (
                  <button key={y} type="button" className={'neg-year-opt' + (offer.years === y ? ' selected' : '')} disabled={y < minYears} onClick={() => setYears(y)}>{y}</button>
                ))}
              </div>
            </div>
            {error && <div className="neg-error">{error}</div>}
            <button type="button" className="primary neg-roll-btn" onClick={submitOpen}>Submit Opening Bid</button>
            <div className="neg-note">Holds {formatCoins(offer.salary)} of your {formatCoins(room)} room until close.</div>
          </>
        )}

        {!resolved && myBid && myBid.stage === 'opening' && (
          <>
            <div className="neg-band-split"><span>One raise · salary, years, or both · neither can drop</span></div>
            <div className="neg-stepper-row">
              <span className="neg-microlabel">Salary / Season · was {formatCoins(floor.salary)}</span>
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
            {error && <div className="neg-error">{error}</div>}
            <div className="neg-actions">
              <button type="button" className="primary" disabled={offer.salary === floor.salary && offer.years === floor.years} onClick={submitRaise}>Raise Bid</button>
              <button type="button" className="secondary" onClick={standPat}>Stand Pat</button>
            </div>
          </>
        )}

        {!resolved && myBid && myBid.stage === 'final' && (
          <div className="neg-note">Your offer is final. Bidding resolves {market === 'contracts' ? 'when every human club begins the draft.' : 'after every human GM closes free agency.'}</div>
        )}

        {resolved && result && (
          <div className={'neg-result ' + (result.unsigned ? 'walked' : result.winnerTeamId === team.id ? 'signed' : 'walked')}>
            {result.unsigned ? (
              <div className="neg-stamp walked">Unsigned · Back In The Pool</div>
            ) : (
              <>
                <div className={'neg-stamp ' + (result.winnerTeamId === team.id ? 'signed' : 'walked')}>Signed · {result.winnerTeamName}</div>
                <div className="neg-figure big">{formatCoins(result.salary)} × {result.years} yrs</div>
                {result.uncontested && <p className="neg-note">No one else bid — signed at their own terms, no roll.</p>}
                {!result.uncontested && result.rolls?.length > 0 && (
                  <div className="bid-board tie-roll-board">
                    <div className="bid-board-head"><span>Team</span><span>Tiebreak Roll</span></div>
                    {[...result.rolls].sort((a, b) => b.roll - a.roll).map((r) => (
                      <div key={r.teamId} className="bid-board-row">
                        <span>{r.teamName}{r.teamId === result.winnerTeamId ? ' · Won' : ''}</span>
                        <span>{r.roll}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!result.uncontested && !result.tied && <p className="neg-note">Best final offer for this player's {String(result.priority).toLowerCase()} priority.</p>}
              </>
            )}
            <button type="button" className="primary" onClick={onClose}>Back to Free Agency</button>
          </div>
        )}
      </div>
    </div>
  );
}
