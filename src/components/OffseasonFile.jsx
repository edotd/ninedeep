import { rosterSalary, formatCoins } from '../game/economy';
import { ROSTER_SIZE } from '../game/constants';

export default function OffseasonFile({ team, children }) {
  const used = rosterSalary(team);
  return <div className="offseason-file">
    <div className="of-content">{children}</div>
    <div className="of-ledger"><span>ROSTER <b>{team.hand.length}/{ROSTER_SIZE}</b></span><span>BUDGET <b>{formatCoins(used)} / {formatCoins(team.seasonCap || 0)}</b></span><span>ROOM <b className={used > team.seasonCap ? 'negative' : ''}>{formatCoins((team.seasonCap || 0) - used)}</b></span></div>
  </div>;
}
