import PlayerCard from '../components/PlayerCard';
import { rosterSalary, formatCoins } from '../game/economy';

export default function FreeAgencyScreen({ state, actions }) {
  const team = state.teams[0];
  const openSlots = 9 - team.hand.length;
  const total9 = rosterSalary(team);
  const overCap = total9 > team.seasonCap;
  const lost = state.lastExpiredPlayers || [];

  return (
    <>
      <div className="screen">
        <h1>Free Agency</h1>
        <div className={'statusline' + (overCap ? ' bad' : '')}>
          Roster salary: {formatCoins(total9)} / {formatCoins(team.seasonCap)} cap{overCap ? ' — luxury tax will apply' : ''}
        </div>
        <p className="lede">You have {openSlots} open roster spot{openSlots === 1 ? '' : 's'}. Sign from the free agent pool or bring in undrafted talent.</p>
        {openSlots > 0 && lost.length > 0 && (
          <>
            <h2>Players Lost to Free Agency ({lost.length})</h2>
            {lost.map((c, i) => (
              <div key={i} className="standing-row">
                <span>{c.archetype} <span style={{ color: 'var(--muted)' }}>({c.position})</span></span>
                <span>{c.tierName} · contract expired</span>
              </div>
            ))}
          </>
        )}
        <button className="secondary" style={{ width: '100%', marginBottom: 14 }} onClick={() => {
          const res = actions.signReplacement();
          if (res && res.ok === false) alert(res.msg);
        }}>Sign Undrafted Talent</button>
        <h2>Free Agent Pool ({state.freeAgents.length})</h2>
        {state.freeAgents.length ? state.freeAgents.map((c) => (
          <PlayerCard key={c.id} card={c} draftStyle onClick={() => {
            const res = actions.signFreeAgent(c.id);
            if (res && res.ok === false) alert(res.msg);
          }} />
        )) : <p className="lede">Pool is empty right now.</p>}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.finishFreeAgency}>
          {state.season >= 8 ? 'View Era Results' : `Continue to Season ${state.season + 1}`}
        </button>
      </div>
    </>
  );
}
