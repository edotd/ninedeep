import OffseasonFile from '../components/OffseasonFile';
import PlayerCard from '../components/PlayerCard';
import { formatCoins } from '../game/economy';
import { offseasonPrice } from '../game/gm';

export default function ContractsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const expired = (state.lastExpiredPlayers || []).filter((c) => c.lastTeamId === team.id && state.freeAgents.some((fa) => fa.id === c.id));
  const filed = state.offseason?.contractsFiled?.[team.id];
  return <OffseasonFile state={state} team={team}>
    <div className="of-section-label">01 / CONTRACTS</div><h1>Contract Ledger</h1>
    <p className="lede">Season {state.season} is closed. Renew an expired player now, or let their contract lapse to free agency, then file your contracts before the draft.</p>
    {expired.length > 0 && (
      <>
        <div className="of-section-label">Expiring · Renew Or Let Go ({expired.length})</div>
        <div className="fa-grid">
          {expired.map((c) => {
            const price = offseasonPrice(team, c.salary);
            return (
              <div key={c.id}>
                <PlayerCard card={{ ...c, salary: price }} />
                <button
                  className="pcard-renew"
                  disabled={filed || team.hand.length >= 9}
                  onClick={() => {
                    const res = actions.renewExpiredContract(myTeamId, c.id);
                    if (res && res.ok === false) alert(res.msg);
                  }}
                >
                  Renew — {formatCoins(price)}
                </button>
              </div>
            );
          })}
        </div>
      </>
    )}
    <div className="of-section-label">Under Contract ({team.hand.length})</div>
    <div className="of-table-head"><span>PLAYER / POSITION</span><span>SALARY</span><span>TERM</span></div>
    {team.hand.map((c) => <div className="of-table-row" key={c.id}><span>{c.archetype}<small>{c.position}</small></span><span>{formatCoins(c.salary)}</span><strong>{c.contract} YR</strong></div>)}
    <button className="primary of-action" disabled={filed} onClick={() => actions.fileContracts(myTeamId)}>{filed ? 'FILED · WAITING FOR OTHER CLUBS' : 'FILE CONTRACTS & CONTINUE'}</button>
  </OffseasonFile>;
}
