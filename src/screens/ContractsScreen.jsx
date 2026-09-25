import { useState } from 'react';
import OffseasonFile from '../components/OffseasonFile';
import PlayerCard from '../components/PlayerCard';
import NegotiationModal from '../components/NegotiationModal';
import { formatCoins } from '../game/economy';
import { negotiationBand, negotiationAcceptChance } from '../game/negotiation';

export default function ContractsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const expired = (state.lastExpiredPlayers || []).filter((c) => c.lastTeamId === team.id && state.freeAgents.some((fa) => fa.id === c.id));
  const filed = state.offseason?.contractsFiled?.[team.id];
  const freeAgencyClosed = state.offseason?.freeAgencyClosed?.[team.id];
  // Holds the actual card object, not just an id looked up live in state.freeAgents — a
  // successful negotiation splices the card out of freeAgents the instant it signs, and the
  // modal still needs to render its own SIGNED/WALKED result screen for a beat after that.
  const [negotiatingCard, setNegotiatingCard] = useState(null);
  return (
    <>
      <OffseasonFile state={state} team={team}>
        <div className="of-section-label">01 / NEGOTIATIONS</div><h1>Expiring Contracts</h1>
        <div className="of-section-label">Expiring · Renew Or Let Go ({expired.length})</div>
        {expired.length > 0 ? (
          <div className="fa-grid">
            {expired.map((c) => {
              const band = negotiationBand(c.salary, c.maxContract, c.salary, c.maxContract);
              const chance = negotiationAcceptChance(band);
              return (
                <div key={c.id}>
                  <PlayerCard card={c} contractLabel="Requested Contract Duration" signingNote={`${band} · ${chance}% to sign at the ask`} />
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
                </div>
              );
            })}
          </div>
        ) : <p className="lede">No expired contracts this season.</p>}
      </OffseasonFile>
      <div className="bottombar">
        <button className="primary" disabled={filed || !freeAgencyClosed} onClick={() => actions.fileContracts(myTeamId)}>
          {filed ? 'Filed · Waiting For Other Clubs' : freeAgencyClosed ? 'Begin Draft' : 'Close Out Free Agency First'}
        </button>
      </div>
      {negotiatingCard && (
        <NegotiationModal state={state} actions={actions} myTeamId={myTeamId} card={negotiatingCard} onClose={() => setNegotiatingCard(null)} />
      )}
    </>
  );
}
