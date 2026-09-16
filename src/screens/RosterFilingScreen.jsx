import OffseasonFile from '../components/OffseasonFile';
import { formatCoins } from '../game/economy';

export default function RosterFilingScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const filed = state.offseason?.rosterFiled?.[team.id];
  return <OffseasonFile state={state} team={team}>
    <div className="of-section-label">04 / ROSTER</div><h1>Roster Completion</h1>
    <p className="lede">File your nine player roster. Your starting five is selected next.</p>
    <div className="of-table-head"><span>PLAYER / POSITION</span><span>SALARY</span><span>TERM</span></div>
    {team.hand.map((c) => <div className="of-table-row" key={c.id}><span>{c.archetype}<small>{c.position}</small></span><span>{formatCoins(c.salary)}</span><strong>{c.contract} YR</strong></div>)}
    <button className="primary of-action" disabled={filed || team.hand.length !== 9} onClick={() => actions.fileRoster(myTeamId)}>{filed ? 'FILED · WAITING FOR OTHER CLUBS' : team.hand.length !== 9 ? 'ROSTER INCOMPLETE' : 'FILE ROSTER & CONTINUE'}</button>
  </OffseasonFile>;
}
