import { formatCoins } from '../game/economy';
import { fanbaseSummary } from '../game/summaries';

function CoachCard({ coach }) {
  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="card-name">{coach.archetype} <span className="tier-pill">{coach.modifier}</span></div>
          <div className="card-sub">Coach</div>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat"><b>+{Math.round(coach.offBonus * 100)}%</b><span>Off Bonus</span></div>
        <div className="stat"><b>+{Math.round(coach.defBonus * 100)}%</b><span>Def Bonus</span></div>
        <div className="stat"><b>d{coach.offDie}</b><span>Off Die</span></div>
        <div className="stat"><b>d{coach.defDie}</b><span>Def Die</span></div>
        <div className="stat"><b>{coach.age}</b><span>Age</span></div>
        <div className="stat"><b>{coach.playerRelationship}</b><span>Relationship</span></div>
      </div>
      <div className="meta-row"><div className="meta-cell"><b>{formatCoins(coach.salary)}</b><span>Salary</span></div></div>
      {coach.ability && <div className="statusline" style={{ marginTop: 8 }}>Ability: {coach.ability}</div>}
    </div>
  );
}

function Slot({ label, value, onPull, extra }) {
  if (value) {
    return (
      <div className="pull-slot revealed">
        <div className="pull-label">{label}</div>
        <div className="pull-value">{value.name}</div>
        {extra && <div className="pull-extra">{extra}</div>}
      </div>
    );
  }
  return (
    <div className="pull-slot">
      <div className="pull-label">{label}</div>
      <button className="secondary" style={{ width: '100%' }} onClick={onPull}>Pull Card</button>
    </div>
  );
}

export default function PullCardsScreen({ state, actions }) {
  const team = state.teams[0];
  const allPulled = team.coach && team.fanbase && team.market;
  const marketExtra = team.market ? `+${formatCoins(team.market.capAdj)} to cap each season` : '';
  const fanbaseExtra = team.fanbase ? fanbaseSummary(team) + (team.fanbase.ability ? ' · ' + team.fanbase.ability : '') : '';

  return (
    <>
      <div className="screen">
        <h1>Front Office</h1>
        <p className="lede">Pull your Coach, Fanbase, and Market cards. These are kept for the whole era — choose (or accept) them once, before your 9-card hand is dealt.</p>
        {team.coach ? (
          <>
            <div className="pull-label" style={{ marginBottom: 8 }}>Coach</div>
            <CoachCard coach={team.coach} />
          </>
        ) : (
          <div className="pull-slot">
            <div className="pull-label">Coach</div>
            <button className="secondary" style={{ width: '100%' }} onClick={actions.pullCoach}>Pull Card</button>
          </div>
        )}
        <Slot label="Fanbase" value={team.fanbase} onPull={actions.pullFanbase} extra={fanbaseExtra} />
        <Slot label="Market" value={team.market} onPull={actions.pullMarket} extra={marketExtra} />
      </div>
      <div className="bottombar">
        <button className="primary" disabled={!allPulled} onClick={actions.proceedToSeason1}>Deal Hands</button>
      </div>
    </>
  );
}
