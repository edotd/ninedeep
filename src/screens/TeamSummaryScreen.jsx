import TeamChemistry from '../components/TeamChemistry';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';
import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { teamSynergy } from '../game/skillsets';
import { cardTier } from '../game/cards';
import { FANBASE_BOOST_COST, FIRE_GM_COST } from '../game/constants';
import MatchupCard from '../components/MatchupCard';

const ERA_LENGTH = 8;

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// The Team Summary screen — "the file the league keeps on you" (design brand handoff, 1a).
// Serves two roles from the same markup: as the 'teamsummary' phase (shown once per season,
// after the Matchup Cards pull and the Constructing loading beat — its own button confirms
// the season on the auto-selected five, the last stop before the season locks), and — when
// passed `onBack` — as the "Team" overlay reachable from the sidebar/top bar on any phase,
// where the button instead just closes the overlay and the front-office moves (fire/hire
// coach, fire GM, invest in fanbase — all funded out of budget room) are available.
// Read-only otherwise, organised by category: rotation, budget ledger, front office. No
// nine-slot navigation here (that's the persistent bar's job on every other screen).
export default function TeamSummaryScreen({ state, actions, myTeamId, onBack }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  // A quick preview of the buyout cost — the actual new hire is drawn fresh when the button
  // is clicked, so this number is an estimate (their salary could land higher or lower).
  const fireCostEstimate = team.coach ? Math.round((team.coach.salary + team.coach.salary) * 10) / 10 : 0;
  const activeSet = new Set(team.activeIds || []);
  const starters = team.hand.filter((c) => activeSet.has(c.id));
  const bench = team.hand.filter((c) => !activeSet.has(c.id));
  const openSlots = 9 - team.hand.length;
  const otherHumans = state.teams.filter((t) => t.human && t.id !== team.id);
  const waitingOn = otherHumans.filter((t) => !t.lineupConfirmed);

  const committed = rosterSalary(team);
  const cap = team.seasonCap || 0;
  const room = cap - committed;
  const expiring = team.hand.filter((c) => c.contract <= 1);
  const expiringTotal = expiring.reduce((s, c) => s + c.salary, 0);

  const output = team.coach && team.activeIds && team.activeIds.length > 0 ? teamOutput(team) : null;
  const chemistry = team.coach ? teamExperience(team) : null;
  const synergy = teamSynergy(team);

  // Ranked against every other team that also has a lineup set — same "Nth of the league"
  // framing as Standings, but scoped to whatever this game's actual team count is rather than
  // a fixed number.
  const leagueOutputs = state.teams.map((t) => (t.coach && t.activeIds && t.activeIds.length > 0 ? teamOutput(t) : null));
  const rankedCount = leagueOutputs.filter(Boolean).length;
  const rankFor = (key) => {
    if (!output) return null;
    const better = leagueOutputs.filter((o) => o && o[key] > output[key]).length;
    return better + 1;
  };

  const canEdit = state.phase === 'teamsummary' && !team.lineupConfirmed;
  const handleRelease = (card) => {
    if (!window.confirm(`Release ${card.archetype} · ${card.position}? This carries ${formatCoins(card.salary)} in dead money against your budget this season.`)) return;
    const res = actions.releasePlayer(myTeamId, card.id);
    if (res && res.ok === false) alert(res.msg);
  };

  return (
    <>
      <div className="screen ts-screen">
        <div className="ts-masthead">
          <div className="ts-masthead-left">
            <div className="ts-masthead-label">TEAM FILE{team.market ? ` · ${team.market.name.toUpperCase()}` : ''}</div>
            <div className="ts-masthead-name">{team.name}</div>
            <div className="ts-franchise-history">
              <div className="ts-era">
                <div className="ts-era-label">ERA 01 · YR {seasonNum} OF {ERA_LENGTH}</div>
                <div className="ts-era-bar">
                  {Array.from({ length: ERA_LENGTH }, (_, i) => (
                    <div key={i} className={'ts-era-seg' + (i < seasonNum ? ' done' : '')} />
                  ))}
                </div>
              </div>
              <div className="ts-titles">
                <div className="ts-titles-value">{team.titles}</div>
                <div className="ts-titles-label">CHAMPIONSHIP{team.titles === 1 ? '' : 'S'}</div>
              </div>
            </div>
          </div>
          <div className="ts-masthead-right">
            <div className="ts-hero-metric chemistry">
              <div className="ts-proj-label">Chemistry</div>
              <div className="ts-hero-value">{synergy.grade}</div>
              <div className="ts-proj-rank">Score {synergy.score}</div>
            </div>
            <div className="ts-hero-metric">
              <div className="ts-proj-label">Proj Offense</div>
              <div className="ts-hero-value accent">{output ? output.off : '—'}</div>
              {output && <div className="ts-proj-rank">{ordinal(rankFor('off'))} of {rankedCount}</div>}
            </div>
            <div className="ts-hero-metric">
              <div className="ts-proj-label">Proj Defense</div>
              <div className="ts-hero-value">{output ? output.def : '—'}</div>
              {output && <div className="ts-proj-rank">{ordinal(rankFor('def'))} of {rankedCount}</div>}
            </div>
            <div className="ts-hero-metric">
              <div className="ts-proj-label">Bench Output</div>
              <div className="ts-hero-value">{output ? output.bench : '—'}</div>
              {output && <div className="ts-proj-rank">{ordinal(rankFor('bench'))} of {rankedCount}</div>}
            </div>
          </div>
        </div>

        <div className="ts-body">
          <div className="ts-section">
            <div className="ts-heading">Rotation</div>
            <div className="ts-roto-scroll">
              <div className="ts-roto-grid">
                {starters.map((c) => <PlayerCard key={c.id} card={c} onRelease={canEdit ? handleRelease : undefined} />)}
              </div>
            </div>
          </div>

          <div className="ts-section">
            <div className="ts-heading">Bench</div>
            <div className="ts-roto-scroll">
              <div className="ts-roto-grid">
                {bench.map((c) => <PlayerCard key={c.id} card={c} onRelease={canEdit ? handleRelease : undefined} />)}
                {Array.from({ length: Math.max(0, openSlots) }, (_, i) => (
                  <div key={'open' + i} className="ts-bench-open">OPEN</div>
                ))}
                {openSlots <= 0 && bench.length < 4 && (
                  <div className="ts-bench-open">ROSTER FULL</div>
                )}
              </div>
            </div>
          </div>

          <TeamChemistry
            team={team}
            canEdit={canEdit}
            onSwap={(outgoing, incoming) => actions.swapStarter(myTeamId, outgoing, incoming)}
            onPromote={(incoming) => actions.promoteToStarter(myTeamId, incoming)}
          />

          <div className="ts-section">
            <div className="ts-heading">Budget Ledger</div>
            <div className="ts-budget-figures">
              <span className="committed">{formatCoins(committed).replace('🪙', '')}</span>
              <span className="slash"> / </span>
              <span className="limit">{formatCoins(cap).replace('🪙', '')}</span>
              <span className={'ts-budget-room' + (room < 0 ? ' bad' : '')}>{room >= 0 ? '+' : ''}{Math.round(room * 10) / 10} ROOM</span>
            </div>
            <div className="ts-budget-bar">
              {team.hand.map((c) => (
                <div
                  key={c.id}
                  className={'ts-budget-seg' + (cardTier(c) === 'EXP' ? ' exp' : activeSet.has(c.id) ? '' : ' bench')}
                  style={{ width: `${cap ? Math.max(2, (c.salary / cap) * 100) : 100 / (team.hand.length || 1)}%` }}
                />
              ))}
            </div>
            <div className="ts-ledger-row"><span>Committed This Season</span><span>{formatCoins(committed)}</span></div>
            <div className="ts-ledger-row"><span>GM Budget Hit</span><span>{formatCoins(team.gmType === 'Aggressive' || team.gmType === 'Hands-Off' ? 1 : 0)}</span></div>
            <div className="ts-ledger-row"><span>Expiring This Season</span><span className={expiring.length ? 'bad' : ''}>{expiring.length ? `${formatCoins(expiringTotal)} · ${expiring.map((c) => c.archetype).join(', ')}` : 'None'}</span></div>
            <div className="ts-metrics">
              <div><div className="ts-metric-label">Experience</div><div className="ts-metric-value">{chemistry !== null ? chemistry : '—'}</div></div>
              <div><div className="ts-metric-label">Proj Off</div><div className="ts-metric-value accent">{output ? output.total : '—'}</div></div>
            </div>
          </div>

          {team.coach && team.market && (
            <div className="ts-section">
              <div className="ts-heading">Front Office</div>
              <div className="fo-deal-row" style={{ margin: 0 }}>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="coach" team={team} />
                  <button
                    className="secondary ts-fo-action"
                    style={{ width: '100%' }}
                    onClick={() => {
                      const res = actions.fireCoach(myTeamId);
                      if (res && res.ok === false) alert(res.msg);
                    }}
                  >
                    Fire Coach — Est. {formatCoins(fireCostEstimate)}+ Dead
                  </button>
                </div>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="fanbase" team={team} />
                  <button
                    className="secondary ts-fo-action"
                    style={{ width: '100%' }}
                    disabled={team.financeBoostUsedThisSeason}
                    onClick={() => {
                      const res = actions.investInFanbase(myTeamId);
                      if (res && res.ok === false) alert(res.msg);
                    }}
                  >
                    {team.financeBoostUsedThisSeason ? 'Already Invested This Season' : `Invest — ${formatCoins(FANBASE_BOOST_COST)}`}
                  </button>
                </div>
                <div className="ts-fo-col">
                  <FrontOfficeCard kind="market" team={team} />
                  <button
                    className="secondary ts-fo-action"
                    style={{ width: '100%' }}
                    disabled={team.gmChangeSeason === state.season}
                    onClick={() => {
                      const res = actions.fireGM(myTeamId);
                      if (res && res.ok === false) alert(res.msg);
                    }}
                  >
                    {team.gmChangeSeason === state.season ? 'GM Replaced This Season' : `Fire GM — ${formatCoins(FIRE_GM_COST)}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(team.matchupCards || []).length > 0 && (
            <div className="ts-section">
              <div className="ts-heading">Matchup Cards</div>
              <div className="mu-deal-row" style={{ margin: 0 }}>
                {team.matchupCards.map((c) => <MatchupCard key={c.id} card={c} />)}
              </div>
            </div>
          )}
        </div>

        {team.lineupConfirmed && waitingOn.length > 0 && (
          <div className="statusline" style={{ marginTop: 16 }}>Season locked — waiting on {waitingOn.map((t) => t.name).join(', ')}…</div>
        )}
        {state.phase === 'teamsummary' && team.hand.length !== 9 && (
          <div className="statusline" style={{ marginTop: 16 }}>
            Resolve your roster before the season begins: {team.hand.length > 9 ? `release ${team.hand.length - 9} player${team.hand.length - 9 === 1 ? '' : 's'}` : `sign ${9 - team.hand.length} player${9 - team.hand.length === 1 ? '' : 's'} from Free Agency`}.
          </div>
        )}
        {state.phase === 'teamsummary' && team.hand.length === 9 && committed > cap && (
          <div className="statusline" style={{ marginTop: 16 }}>Get under budget before the season begins. Reduce committed costs by {formatCoins(committed - cap)}.</div>
        )}
      </div>
      <div className="bottombar">
        {onBack ? (
          <button className="primary" onClick={onBack}>Back</button>
        ) : (
          <button
            className="primary"
            disabled={team.lineupConfirmed}
            onClick={() => {
              const res = actions.confirmLineup(myTeamId);
              if (res && res.valid === false) alert(res.msg);
            }}
          >
            {team.lineupConfirmed ? 'Waiting…' : team.hand.length !== 9 ? `Resolve Roster · ${team.hand.length}/9` : committed > cap ? 'Resolve Budget' : 'Begin Season'}
          </button>
        )}
      </div>
    </>
  );
}
