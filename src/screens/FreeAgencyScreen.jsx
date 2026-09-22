import PlayerCard from '../components/PlayerCard';
import { formatCoins } from '../game/economy';
import { offseasonPrice } from '../game/gm';
import { wasReleasedByTeamThisSeason } from '../game/season';

export default function FreeAgencyScreen({ state, actions, myTeamId, onBack }) {
  const team = state.teams[myTeamId];
  const openSlots = Math.max(0, 9 - team.hand.length);
  return (
    <div className="screen">
      <div className="screen-kicker">League Personnel Wire</div>
      <h1>Free Agency</h1>
      <p className="lede">Browse available players at any time. Signing is optional and available whenever your roster has an open spot.</p>
      <div className="statusline">Roster {team.hand.length}/9 · {openSlots ? `${openSlots} open spot${openSlots === 1 ? '' : 's'}` : 'No open roster spots'}</div>
      {state.freeAgents.length ? (
        <div className="fa-grid">
          {state.freeAgents.map((card) => {
            const price = offseasonPrice(team, card.salary);
            const releasedHere = wasReleasedByTeamThisSeason(card, team, state.season);
            const sign = () => {
              const result = actions.signFreeAgent(card.id, myTeamId);
              if (result && result.ok === false) alert(result.msg);
            };
            return (
              <div key={card.id}>
                <PlayerCard card={{ ...card, salary: price }} />
                <button className="pcard-renew" disabled={!openSlots || releasedHere} onClick={sign}>
                  {releasedHere ? 'Released This Season' : `Sign — ${formatCoins(price)}`}
                </button>
              </div>
            );
          })}
        </div>
      ) : <p className="lede">No players are currently available.</p>}
      <div className="bottombar"><button className="primary" onClick={onBack}>Back</button></div>
    </div>
  );
}
