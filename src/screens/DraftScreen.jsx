import PlayerCard from '../components/PlayerCard';
import { cardTotal } from '../game/cards';
import { formatCoins } from '../game/economy';
import OffseasonFile from '../components/OffseasonFile';
import { offseasonPrice } from '../game/gm';

export default function DraftScreen({ state, actions, myTeamId }) {
  const draft = state.draft;
  const myTeam = state.teams[myTeamId];
  const sortedPool = [...draft.pool].sort((a, b) => cardTotal(b) - cardTotal(a));
  const onTheClock = draft.queue[0] === myTeam;

  const laterTeams = [];
  const seen = new Set();
  draft.queue.forEach((t, i) => {
    if (i > 0 && t !== myTeam && !seen.has(t)) {
      seen.add(t);
      laterTeams.push({ team: t, slotsAway: i });
    }
  });

  return (
    <OffseasonFile state={state} team={myTeam}>
      <div className="of-section-label">02 / DRAFT</div><h1>Draft — Season {state.season}</h1>
      <p className="lede">
        Every team gets one pick, worst record first. Draft picks can take a roster above nine players; resolve your final nine on the Team screen after the draft.{' '}
        {onTheClock
          ? "You're on the clock — draft a card, or trade your pick down to another team for a cap bonus next season."
          : draft.queue[0] ? `Waiting on ${draft.queue[0].name} to pick…` : ''}
      </p>
      <div className="statusline">{draft.queue.length} pick{draft.queue.length === 1 ? '' : 's'} remaining · {draft.pool.length} card{draft.pool.length === 1 ? '' : 's'} in the pool</div>

      {draft.picks.length > 0 && (
        <>
          <h2>Recent Picks</h2>
          {draft.picks.slice(0, 5).map((p, i) => (
            <div key={i} className={'standing-row' + (p.teamId === myTeamId ? ' you' : '')}>
              <span>{p.teamName}</span>
              <span>{p.card.archetype} · {p.card.tierName}</span>
            </div>
          ))}
        </>
      )}

      {onTheClock && laterTeams.length > 0 && (
        <>
          <h2>Trade Down</h2>
          {laterTeams.map(({ team, slotsAway }) => (
            <div
              key={team.name}
              className="pull-slot"
              style={{ cursor: 'pointer' }}
              onClick={() => actions.tradeDown(myTeamId, state.teams.indexOf(team))}
            >
              <div className="pull-label">Swap with {team.name}</div>
              <div className="pull-value" style={{ fontSize: 15 }}>
                Move back {slotsAway} pick{slotsAway === 1 ? '' : 's'} for +{formatCoins(Math.max(0.5, slotsAway * 0.5))} cap next season
              </div>
            </div>
          ))}
        </>
      )}

      <h2>Available Cards ({sortedPool.length})</h2>
      <div className="fa-grid">
        {sortedPool.map((c) => {
          const priced = { ...c, salary: offseasonPrice(myTeam, c.salary) };
          const pick = () => actions.draftPick(myTeamId, c.id);
          return (
            <div key={c.id}>
              <PlayerCard card={priced} onClick={onTheClock ? pick : undefined} />
              {onTheClock && <button className="pcard-renew" onClick={pick}>Select</button>}
            </div>
          );
        })}
      </div>
    </OffseasonFile>
  );
}
