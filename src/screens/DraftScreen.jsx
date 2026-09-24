import PlayerCard from '../components/PlayerCard';
import { cardTotal, jerseyNumber, playerGrade } from '../game/cards';
import { careerLevel } from '../game/aging';
import { formatCoins } from '../game/economy';
import OffseasonFile from '../components/OffseasonFile';
import { offseasonPrice } from '../game/gm';

// "Number + Grade + Career + Tier + Position" — the one full-identity line the draft order
// table and this screen's Recent Picks list both use for a pick's card.
function pickLine(card) {
  return `#${jerseyNumber(card)} · ${playerGrade(card)} · ${careerLevel(card)} · ${card.tierName} · ${card.position}`;
}

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
        Every team gets one pick, worst record first.{' '}
        {onTheClock
          ? "You're on the clock - draft a player or forfeit your pick for a cap bonus next season."
          : draft.queue[0] ? `Waiting on ${draft.queue[0].name} to pick…` : ''}
      </p>
      <div className="statusline">{draft.queue.length} pick{draft.queue.length === 1 ? '' : 's'} remaining · {draft.pool.length} card{draft.pool.length === 1 ? '' : 's'} in the pool</div>

      {onTheClock && (
        <button
          className="secondary"
          style={{ width: '100%', marginTop: 6 }}
          onClick={() => {
            const res = actions.forfeitPick(myTeamId);
            if (res && res.ok === false) alert(res.msg);
          }}
        >
          Forfeit Pick — +{formatCoins(1)} Cap Next Season
        </button>
      )}

      {(draft.picks.length > 0 || draft.queue.length > 0) && (
        <>
          <h2>Draft Order</h2>
          {[...draft.picks].reverse().map((p, i) => (
            <div key={'picked-' + p.card.id} className={'standing-row' + (p.teamId === myTeamId ? ' you' : '')}>
              <span>#{i + 1} {p.teamName}</span>
              <span>{p.card.archetype} — {pickLine(p.card)}</span>
            </div>
          ))}
          {draft.queue.map((t, i) => (
            <div key={'pending-' + t.id} className={'standing-row' + (t === myTeam ? ' you' : '')}>
              <span>#{draft.picks.length + i + 1} {t.name}</span>
              <span>{i === 0 ? 'On the clock' : 'Pending'}</span>
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
