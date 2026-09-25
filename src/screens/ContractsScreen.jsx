import OffseasonFile from '../components/OffseasonFile';
import PlayerCard from '../components/PlayerCard';
import { formatCoins } from '../game/economy';
import { offseasonPrice } from '../game/gm';

export default function ContractsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const expired = (state.lastExpiredPlayers || []).filter((c) => c.lastTeamId === team.id && state.freeAgents.some((fa) => fa.id === c.id));
  const filed = state.offseason?.contractsFiled?.[team.id];
  return (
    <>
      <OffseasonFile state={state} team={team}>
        <div className="of-section-label">01 / NEGOTIATIONS</div><h1>Expiring Contracts</h1>
        <div className="of-section-label">Expiring · Renew Or Let Go ({expired.length})</div>
        {expired.length > 0 ? (
          <div className="fa-grid">
            {expired.map((c) => {
              const price = offseasonPrice(team, c.salary);
              return (
                <div key={c.id}>
                  <PlayerCard card={{ ...c, salary: price }} contractLabel="Requested Contract Duration" />
                  <button
                    className="pcard-renew"
                    disabled={filed || team.hand.length >= 9}
                    onClick={() => {
                      const res = actions.renewExpiredContract(myTeamId, c.id);
                      if (res && res.ok === false) alert(res.msg);
                    }}
                  >
                    Negotiate — {formatCoins(price)}
                  </button>
                </div>
              );
            })}
          </div>
        ) : <p className="lede">No expired contracts this season.</p>}
      </OffseasonFile>
      <div className="bottombar">
        <button className="primary" disabled={filed} onClick={() => actions.fileContracts(myTeamId)}>{filed ? 'Filed · Waiting For Other Clubs' : 'Begin Draft'}</button>
      </div>
    </>
  );
}
