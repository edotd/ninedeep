import { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import NegotiationModal from '../components/NegotiationModal';
import BiddingModal from '../components/BiddingModal';
import { formatCoins } from '../game/economy';
import { negotiationBand, negotiationAcceptChance } from '../game/negotiation';

// Every player whose contract expired at the end of THIS season, league-wide — not just this
// team's own (see season.js's proceedFromResults, which tags every expiring card with
// expiredSeason regardless of whose roster it came from). state.freeAgents is a single
// era-long pool, so this is the only reliable way to isolate "just expired" from years of
// accumulated, still-unsigned free agents.
function expiringThisSeason(state) {
  return state.freeAgents.filter((c) => c.expiredSeason === state.season);
}

export default function ContractsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const filed = state.offseason?.contractsFiled?.[team.id];
  const readyTeams = state.teams.filter((candidate) => candidate.human && state.offseason?.contractsFiled?.[candidate.id]);
  const expiring = expiringThisSeason(state);
  const groups = state.teams
    .map((t) => ({ team: t, cards: expiring.filter((c) => c.lastTeamId === t.id) }))
    .filter((group) => group.cards.length > 0);

  // Holds the actual card object, not just an id looked up live in state.freeAgents — a
  // successful negotiation splices the card out of freeAgents the instant it signs, and the
  // modal still needs to render its own SIGNED/WALKED result screen for a beat after that.
  const [negotiatingCard, setNegotiatingCard] = useState(null);
  const [biddingCard, setBiddingCard] = useState(null);
  const [confirmingDraft, setConfirmingDraft] = useState(false);

  // Any user can have at most one open bid on the league's expiring-contract board at a time —
  // once placed, every OTHER card's Bid button disables, but the one already bid on stays
  // clickable so its bid can still be raised.
  const myOpenBidCardId = expiring.find((c) => {
    const session = state.offseason?.bidding?.[c.id];
    return session?.status === 'open' && session.bids[team.id];
  })?.id ?? null;

  const beginDraft = () => {
    setConfirmingDraft(false);
    actions.fileContracts(myTeamId);
  };

  return (
    <div className="screen">
      <div className="screen-kicker">League Personnel Wire</div>
      <h1>Expiring Contracts</h1>
      <p className="lede">Every player whose contract expired this season, across the whole league. Renew any of your own; bid on anyone else's — one open bid at a time.</p>

      {groups.length > 0 ? groups.map(({ team: t, cards }) => (
        <div className="ec-team-group" key={t.id}>
          <div className="ec-team-name">{t.name}{t.tricode && <span className="ec-team-tricode">{t.tricode}</span>}</div>
          <div className="ec-row">
            {cards.map((c) => {
              const isMine = t.id === team.id;
              const band = negotiationBand(c.salary, c.maxContract, c.salary, c.maxContract);
              const chance = negotiationAcceptChance(band);
              const canBid = myOpenBidCardId == null || myOpenBidCardId === c.id;
              return (
                <div key={c.id} className="ec-card">
                  <PlayerCard card={c} contractLabel="Requested Contract Duration" signingNote={isMine ? `${band} · ${chance}% to sign at the ask` : undefined} />
                  {isMine ? (
                    <button
                      className="pcard-renew"
                      disabled={filed || team.hand.length >= 9}
                      onClick={() => {
                        const res = actions.openNegotiation(myTeamId, c.id);
                        if (res && res.ok === false) alert(res.msg);
                        else setNegotiatingCard(c);
                      }}
                    >
                      Negotiate — {formatCoins(c.salary)}
                    </button>
                  ) : (
                    <button
                      className="pcard-renew"
                      disabled={filed || !canBid}
                      title={!canBid ? 'You already have an open bid on another player' : undefined}
                      onClick={() => setBiddingCard(c)}
                    >
                      {myOpenBidCardId === c.id ? 'Raise Bid' : 'Bid'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )) : <p className="lede">No contracts are expiring across the league this season.</p>}

      <div className="bottombar">
        <div className="bottombar-action">
          {readyTeams.length > 0 && (
            <div className="season-ready-status" aria-live="polite">
              <span className="season-ready-label">Ready</span>
              <span className="season-ready-teams">{readyTeams.map((readyTeam) => readyTeam.tricode).join(' · ')}</span>
            </div>
          )}
          <button className="primary" disabled={filed} onClick={() => setConfirmingDraft(true)}>
            {filed ? 'Filed · Waiting For Other Clubs' : 'Begin Draft'}
          </button>
        </div>
      </div>

      {negotiatingCard && (
        <NegotiationModal state={state} actions={actions} myTeamId={myTeamId} card={negotiatingCard} onClose={() => setNegotiatingCard(null)} />
      )}
      {biddingCard && (
        <BiddingModal state={state} actions={actions} myTeamId={myTeamId} card={biddingCard} market="contracts" onClose={() => setBiddingCard(null)} />
      )}

      {confirmingDraft && (
        <div className="tsx-overlay" role="dialog" aria-modal="true" aria-label="Begin the draft">
          <div className="neg-panel fa-close-dialog">
            <div className="neg-head">
              <button type="button" className="neg-close" onClick={() => setConfirmingDraft(false)} aria-label="Close">✕</button>
              <div className="neg-head-title">BEGIN DRAFT</div>
            </div>
            <p>Starting the draft will end the off-season signing period and process all open bids on expiring contracts. You will not be able to negotiate or bid on these players once the draft begins.</p>
            <div className="fa-close-actions">
              <button type="button" className="secondary" onClick={() => setConfirmingDraft(false)}>Keep Signing Period Open</button>
              <button type="button" className="primary" onClick={beginDraft}>Begin Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
