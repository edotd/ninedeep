import PlayerCard from '../components/PlayerCard';
import { rosterSalary, formatCoins } from '../game/economy';
import { validateLineup, offenseStatSum, defenseStatSum } from '../game/roster';
import { teamOutput } from '../game/matchup';
import { coachSummary, fanbaseSummary } from '../game/summaries';

export default function LineupScreen({ state, actions }) {
  const team = state.teams[0];
  const activeSet = new Set(team.activeIds);
  const counts = { Guard: 0, Forward: 0, Big: 0 };
  team.activeIds.forEach((id) => { const c = team.hand.find((h) => h.id === id); counts[c.position]++; });
  const total9 = rosterSalary(team);
  const overCap = total9 > team.seasonCap;
  const v = validateLineup(team);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const benchIds = bench.map((c) => c.id);
  const output = teamOutput(team);
  const startersOff = offenseStatSum(team, team.activeIds);
  const startersDef = defenseStatSum(team, team.activeIds);
  const benchOff = offenseStatSum(team, benchIds);
  const benchDef = defenseStatSum(team, benchIds);

  return (
    <>
      <div className="screen">
        <h1>Season {state.season}</h1>
        <div className="frontoffice">
          <div className="fo-card"><b>{team.coach.name}</b><span>{coachSummary(team)}</span></div>
          <div className="fo-card"><b>{team.fanbase.name}</b><span>{fanbaseSummary(team)}</span></div>
          <div className="fo-card"><b>{team.market.name}</b><span>Market</span></div>
        </div>
        {team.matchupCard && (
          <div className="statusline">
            🃏 Matchup Card: <b>{team.matchupCard.name}</b>{team.matchupCard.value !== null ? ` (value ${team.matchupCard.value})` : ''}{team.matchupCard.used ? ' — used' : ''}
          </div>
        )}
        <h2>Your Active Team ({team.activeIds.length}/5)</h2>
        {team.activeIds.length ? (
          <div className="active-tile-row">
            {team.activeIds.map((id) => {
              const c = team.hand.find((h) => h.id === id);
              return (
                <div key={id} className={'active-tile pos-' + c.position}>
                  <div className="active-tile-pos">{c.position.slice(0, 1)}</div>
                  <div className="active-tile-name">{c.archetype}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="lede">No players selected yet — tap cards below to build your five.</p>
        )}
        <p className="lede">Tap cards to add or remove them. You need at least one Guard, Forward, and Big.</p>
        <div className={'statusline' + (overCap ? ' bad' : '')}>
          Roster salary: {formatCoins(total9)} / {formatCoins(team.seasonCap)} cap{overCap ? ' — luxury tax will apply' : ''}
        </div>
        <div className="statusline">
          Team Output: <b>{output.total}</b> (Off {output.off} · Def {output.def} · Bench {output.bench}) — players + coach
        </div>
        <div className="statusline">Active {team.activeIds.length}/5 — Guard {counts.Guard}, Forward {counts.Forward}, Big {counts.Big}</div>
        <div className="statusline">Starters — Offense {startersOff}, Defense {startersDef}</div>
        <div className="statusline">Bench — Offense {benchOff}, Defense {benchDef}</div>
        <h2>Starters ({starters.length}/5)</h2>
        {starters.length ? starters.map((c) => (
          <PlayerCard key={c.id} card={c} selected rosterLabel="Starter" onClick={() => actions.toggleActive(c.id)} />
        )) : <p className="lede">No starters yet.</p>}
        <h2>Bench ({bench.length}/4)</h2>
        {bench.length ? bench.map((c) => (
          <PlayerCard key={c.id} card={c} selected={false} rosterLabel="Bench" onClick={() => actions.toggleActive(c.id)} />
        )) : <p className="lede">Bench is empty.</p>}
      </div>
      <div className="bottombar">
        <button className="secondary" onClick={actions.autoSetHuman}>Auto-Set</button>
        <button className="primary" disabled={!v.valid} onClick={() => {
          const res = actions.confirmLineup();
          if (res && res.valid === false) alert(res.msg);
        }}>Lock Lineup</button>
      </div>
    </>
  );
}
