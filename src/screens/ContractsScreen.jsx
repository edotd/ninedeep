import OffseasonFile from '../components/OffseasonFile';
import { formatCoins } from '../game/economy';

export default function ContractsScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const expired = (state.lastExpiredPlayers || []).filter((c) => c.lastTeamId === team.id && state.freeAgents.some((fa) => fa.id === c.id));
  const filed = state.offseason?.contractsFiled?.[team.id];
  return <OffseasonFile state={state} team={team}>
    <div className="of-section-label">01 / CONTRACTS</div><h1>Contract Ledger</h1>
    <p className="lede">Season {state.season} is closed. Renew an expired player now or release them to free agency, then file your contracts before the draft.</p>
    <div className="of-table-head"><span>PLAYER / POSITION</span><span>SALARY</span><span>TERM</span></div>
    {team.hand.map((c) => <div className="of-table-row" key={c.id}><span>{c.archetype}<small>{c.position}</small></span><span>{formatCoins(c.salary)}</span><strong>{c.contract} YR</strong></div>)}
    {expired.length > 0 && <><div className="of-section-label">EXPIRING · RENEW OR RELEASE</div>{expired.map((c) => <div className="of-table-row expired" key={c.id}><span>{c.archetype}<small>{c.position}</small></span><span>{formatCoins(c.salary)}</span><button className="secondary" disabled={filed || team.hand.length >= 9} onClick={() => actions.renewExpiredContract(myTeamId, c.id)}>RENEW</button></div>)}</>}
    <button className="primary of-action" disabled={filed} onClick={() => actions.fileContracts(myTeamId)}>{filed ? 'FILED · WAITING FOR OTHER CLUBS' : 'FILE CONTRACTS & CONTINUE'}</button>
  </OffseasonFile>;
}
