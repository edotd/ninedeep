import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import MatchupCard from '../components/MatchupCard';
import { formatCoins, rosterSalary } from '../game/economy';
import { offenseStatSum, defenseStatSum } from '../game/roster';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { relocationCost } from '../game/finances';
import { MARKETS, FINANCE_FANBASE_BOOST_COST } from '../game/constants';

function formatFinances(n) {
  return '$' + (Math.round((n || 0) * 10) / 10);
}

// Read-only view of everything about your franchise — Front Office cards, matchup cards,
// and current roster — plus the Team Finances moves (fire/hire coach, relocate market,
// invest in fanbase) — reachable at any time from the top bar, on any phase, so a player can
// always answer "wait, what did I pull again?" without leaving where they are.
export default function TeamScreen({ state, actions, myTeamId, onBack }) {
  const team = state.teams[myTeamId];
  const hasHand = team.hand && team.hand.length > 0;
  const activeSet = new Set(team.activeIds || []);
  const starters = hasHand ? team.hand.filter((c) => activeSet.has(c.id)) : [];
  const bench = hasHand ? team.hand.filter((c) => !activeSet.has(c.id)) : [];
  const benchIds = bench.map((c) => c.id);
  const canShowOutput = team.coach && hasHand && team.activeIds && team.activeIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const experience = team.coach ? teamExperience(team) : null;
  const finances = team.finances || 0;
  // A quick preview of the buyout cost — the actual new hire is drawn fresh when the button
  // is clicked, so this number is an estimate (their salary could land higher or lower).
  const fireCostEstimate = team.coach ? Math.round((team.coach.salary + team.coach.salary) * 10) / 10 : 0;

  return (
    <>
      <div className="screen">
        <h1>{team.name}</h1>
        <p className="lede">Your franchise's Front Office and roster — visible any time, on any screen.</p>

        <div className="statusline">Team Finances: <b>{formatFinances(finances)}</b></div>

        <h2>Front Office</h2>
        {team.coach ? <FrontOfficeCard kind="coach" team={team} /> : (
          <div className="pull-slot"><div className="pull-label">Coach</div><div className="pull-extra">Not pulled yet this season.</div></div>
        )}
        {team.fanbaseArchetype ? <FrontOfficeCard kind="fanbase" team={team} /> : (
          <div className="pull-slot"><div className="pull-label">Fanbase</div><div className="pull-extra">Not pulled yet this season.</div></div>
        )}
        {team.market ? <FrontOfficeCard kind="market" team={team} /> : (
          <div className="pull-slot"><div className="pull-label">Market</div><div className="pull-extra">Not pulled yet this season.</div></div>
        )}
        {team.fanbaseMod && (
          <div className="statusline">
            🏟️ Fanbase Mod: <b>{team.fanbaseMod.name}</b>{team.fanbaseMod.value ? ` (value ${team.fanbaseMod.value})` : ''} — {team.fanbaseMod.flavor}
          </div>
        )}

        {team.coach && team.market && (
          <>
            <h2>Front Office Moves</h2>
            <div className="pull-slot">
              <div className="pull-label">Fire & Replace Coach</div>
              <div className="pull-extra" style={{ marginBottom: 8 }}>Pay off {team.coach.name}'s salary plus the new hire's — a random new coach, no guaranteed upgrade. Est. cost {formatFinances(fireCostEstimate)}+.</div>
              <button
                className="secondary"
                style={{ width: '100%' }}
                onClick={() => {
                  const res = actions.fireCoach(myTeamId);
                  if (res && res.ok === false) alert(res.msg);
                }}
              >
                Fire {team.coach.name}
              </button>
            </div>
            <div className="pull-slot">
              <div className="pull-label">Relocate Market</div>
              <div className="pull-extra" style={{ marginBottom: 8 }}>Jump to any market size — bigger jumps cost more. Currently {team.market.name}.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MARKETS.filter((m) => m.name !== team.market.name).map((m) => {
                  const cost = relocationCost(team, m.name);
                  return (
                    <button
                      key={m.name}
                      className="secondary"
                      style={{ width: '100%' }}
                      onClick={() => {
                        const res = actions.relocateMarket(myTeamId, m.name);
                        if (res && res.ok === false) alert(res.msg);
                      }}
                    >
                      Relocate to {m.name} — {formatFinances(cost)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="pull-slot">
              <div className="pull-label">Invest in Fanbase</div>
              <div className="pull-extra" style={{ marginBottom: 8 }}>A small, permanent bump to your attendance baseline. Once per season.</div>
              <button
                className="secondary"
                style={{ width: '100%' }}
                disabled={team.financeBoostUsedThisSeason}
                onClick={() => {
                  const res = actions.investInFanbase(myTeamId);
                  if (res && res.ok === false) alert(res.msg);
                }}
              >
                {team.financeBoostUsedThisSeason ? 'Already Invested This Season' : `Invest — ${formatFinances(FINANCE_FANBASE_BOOST_COST)}`}
              </button>
            </div>
          </>
        )}

        {(team.matchupCards || []).length > 0 && (
          <>
            <h2>Matchup Cards</h2>
            {team.matchupCards.map((c) => <MatchupCard key={c.id} card={c} />)}
          </>
        )}

        {team.seed && team.seed <= 4 && (
          <div className="statusline">🏟️ Home Court Advantage in the playoffs (seed #{team.seed})</div>
        )}
        {hasHand && team.seasonCap !== undefined && (
          <div className={'statusline' + (rosterSalary(team) > team.seasonCap ? ' bad' : '')}>
            Roster Salary: <b>{formatCoins(rosterSalary(team))}</b> / {formatCoins(team.seasonCap)} cap
          </div>
        )}

        {output && (
          <>
            <div className="statusline">
              Team Output: <b>{output.total}</b> (Off {output.off} · Def {output.def} · Bench {output.bench}) — players + coach
            </div>
            {experience !== null && <div className="statusline">Chemistry: <b>{experience}/10</b></div>}
            <div className="statusline">Starters — Offense {offenseStatSum(team, team.activeIds)}, Defense {defenseStatSum(team, team.activeIds)}</div>
            <div className="statusline">Bench — Offense {offenseStatSum(team, benchIds)}, Defense {defenseStatSum(team, benchIds)}</div>
          </>
        )}

        {hasHand ? (
          <>
            <h2>Starters ({starters.length}/5)</h2>
            {starters.length ? starters.map((c) => <PlayerCard key={c.id} card={c} selected rosterLabel="Starter" />) : <p className="lede">No starters set yet.</p>}
            <h2>Bench ({bench.length})</h2>
            {bench.length ? bench.map((c) => <PlayerCard key={c.id} card={c} selected={false} rosterLabel="Bench" />) : <p className="lede">Bench is empty.</p>}
          </>
        ) : (
          <p className="lede">Your hand hasn't been dealt yet this season.</p>
        )}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
