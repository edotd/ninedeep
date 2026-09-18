import PlayerCard from '../components/PlayerCard';
import { rosterSalary, formatCoins } from '../game/economy';
import OffseasonFile from '../components/OffseasonFile';
import { offseasonPrice } from '../game/gm';

export default function FreeAgencyScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const openSlots = 9 - team.hand.length;
  const total9 = rosterSalary(team);
  const overBudget = total9 > team.seasonCap;
  const lost = (state.lastExpiredPlayers || []).filter((c) => c.lastTeamId === team.id);

  return (
    <>
      <OffseasonFile state={state} team={team}>
        <div className="of-section-label">03 / FREE AGENCY</div><h1>Free Agency</h1>
        <div className={'statusline' + (overBudget ? ' bad' : '')}>
          Roster salary: {formatCoins(total9)} / {formatCoins(team.seasonCap)} budget{overBudget ? ' — luxury tax will apply' : ''}
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
          const res = actions.signReplacement(myTeamId);
          if (res && res.ok === false) alert(res.msg);
        }}>Sign Undrafted Talent</button>
        <h2>Free Agent Pool ({state.freeAgents.length})</h2>
        {state.freeAgents.length ? (
          <div className="fa-grid">
            {state.freeAgents.map((c) => {
              const price = offseasonPrice(team, c.salary);
              const sign = () => {
                const res = actions.signFreeAgent(c.id, myTeamId);
                if (res && res.ok === false) alert(res.msg);
              };
              return (
                <div key={c.id}>
                  <PlayerCard card={{ ...c, salary: price }} draftStyle onClick={sign} />
                  <button className="pcard-renew" disabled={openSlots <= 0} onClick={sign}>Sign — {formatCoins(price)}</button>
                </div>
              );
            })}
          </div>
        ) : <p className="lede">Pool is empty right now.</p>}
      <div className="of-action-wrap">
        <button className="primary of-action" disabled={state.teams.some((t) => t.human && t.hand.length !== 9)} onClick={actions.finishFreeAgency}>
          {openSlots ? `Fill ${openSlots} Open Slot${openSlots === 1 ? '' : 's'}` : 'Continue to Roster Filing'}
        </button>
      </div>
      </OffseasonFile>
    </>
  );
}
