import { rosterSalary, formatCoins } from '../game/economy';

const STEPS = [['contracts', 'Contracts'], ['draft', 'Draft'], ['freeagency', 'Free Agency'], ['roster', 'Roster'], ['offseasonlineup', 'Lineup']];

export default function OffseasonFile({ state, team, children }) {
  const current = STEPS.findIndex(([phase]) => phase === state.phase);
  const used = rosterSalary(team);
  return <div className="offseason-file">
    <div className="of-kicker">02 · OFFSEASON FILE <span>ERA 01 · YR {state.season} OF 8</span></div>
    <div className="of-title">{team.name} <span>PERSONNEL FILE</span></div>
    <nav className="of-index" aria-label="Offseason phases">
      {STEPS.map(([phase, name], i) => <div key={phase} className={i === current ? 'current' : i < current ? 'filed' : ''}><small>0{i + 1}</small>{name}<em>{i < current ? 'FILED' : i === current ? 'OPEN' : 'PENDING'}</em></div>)}
    </nav>
    <div className="of-content">{children}</div>
    <div className="of-ledger"><span>ROSTER <b>{team.hand.length}/9</b></span><span>BUDGET <b>{formatCoins(used)} / {formatCoins(team.seasonCap || 0)}</b></span><span>ROOM <b className={used > team.seasonCap ? 'negative' : ''}>{formatCoins((team.seasonCap || 0) - used)}</b></span></div>
  </div>;
}
