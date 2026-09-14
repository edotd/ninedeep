import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier, rawOverall } from '../game/cards';

const ERA_LENGTH = 8;
const TIER_STRIP = { A: 'var(--franchise)', B: 'var(--ink)', D: 'var(--depth)', EXP: 'var(--stamp)' };

function RotationCard({ card }) {
  const tier = cardTier(card);
  return (
    <div className={'ts-roto-card' + (tier === 'EXP' ? ' exp' : '')}>
      <div className="ts-roto-strip" style={{ background: TIER_STRIP[tier] }} />
      <div className="ts-roto-body">
        <div className="ts-roto-number">{rawOverall(card)}</div>
        <div className="ts-roto-name">{card.archetype}</div>
        <div className="ts-roto-meta">{card.position.slice(0, 1)} · {formatCoins(card.salary)}{tier === 'EXP' ? ' · EXP' : ''}</div>
      </div>
    </div>
  );
}

function BenchStrip({ card }) {
  return (
    <div className="ts-bench-strip">
      <span>{card.archetype}</span>
      <span className="ts-bench-cap">{formatCoins(card.salary)}</span>
    </div>
  );
}

// The Team Summary screen — "the file the league keeps on you" (design brand handoff, 1a) —
// shown once per season, after the Matchup Cards pull and the Constructing loading beat. Its
// own Continue button confirms the season on the auto-selected five (there's no separate
// manual lineup-picking screen any more — this is the last stop before the season locks).
// Read-only otherwise, organised by category: rotation, cap ledger, front office. No
// nine-slot navigation here (that's the persistent bar's job on every other screen).
export default function TeamSummaryScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const seasonNum = Math.min(state.season, ERA_LENGTH);
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

  return (
    <>
      <div className="screen ts-screen">
        <div className="ts-masthead">
          <div className="ts-masthead-left">
            <div className="ts-masthead-label">TEAM FILE{team.market ? ` · ${team.market.name.toUpperCase()}` : ''}</div>
            <div className="ts-masthead-name">{team.name}</div>
          </div>
          <div className="ts-masthead-right">
            <div className="ts-era">
              <div className="ts-era-label">ERA 01 · YR {seasonNum} OF {ERA_LENGTH}</div>
              <div className="ts-era-bar">
                {Array.from({ length: ERA_LENGTH }, (_, i) => (
                  <div key={i} className={'ts-era-seg' + (i < seasonNum ? ' done' : '')} />
                ))}
              </div>
            </div>
            <div className="ts-titles">
              <div className="ts-titles-label">TITLES</div>
              <div className="ts-titles-value">{team.titles}</div>
            </div>
          </div>
        </div>

        <div className="ts-body">
          <div className="ts-section">
            <div className="ts-heading">Rotation</div>
            <div className="ts-roto-grid">
              {starters.map((c) => <RotationCard key={c.id} card={c} />)}
            </div>
            <div className="ts-bench-grid">
              {bench.map((c) => <BenchStrip key={c.id} card={c} />)}
              {Array.from({ length: Math.max(0, openSlots) }, (_, i) => (
                <div key={'open' + i} className="ts-bench-open">OPEN</div>
              ))}
              {openSlots <= 0 && bench.length < 4 && (
                <div className="ts-bench-open">ROSTER FULL</div>
              )}
            </div>
          </div>

          <div className="ts-columns">
            <div className="ts-section">
              <div className="ts-heading">Cap Ledger</div>
              <div className="ts-cap-figures">
                <span className="committed">{formatCoins(committed).replace('🪙', '')}</span>
                <span className="slash"> / </span>
                <span className="limit">{formatCoins(cap).replace('🪙', '')}</span>
                <span className={'ts-cap-room' + (room < 0 ? ' bad' : '')}>{room >= 0 ? '+' : ''}{Math.round(room * 10) / 10} ROOM</span>
              </div>
              <div className="ts-cap-bar">
                {team.hand.map((c) => (
                  <div
                    key={c.id}
                    className={'ts-cap-seg' + (cardTier(c) === 'EXP' ? ' exp' : activeSet.has(c.id) ? '' : ' bench')}
                    style={{ width: `${cap ? Math.max(2, (c.salary / cap) * 100) : 100 / (team.hand.length || 1)}%` }}
                  />
                ))}
              </div>
              <div className="ts-ledger-row"><span>Committed This Season</span><span>{formatCoins(committed)}</span></div>
              <div className="ts-ledger-row"><span>Expiring This Season</span><span className={expiring.length ? 'bad' : ''}>{expiring.length ? `${formatCoins(expiringTotal)} · ${expiring.map((c) => c.archetype).join(', ')}` : 'None'}</span></div>
            </div>

            <div className="ts-section">
              <div className="ts-heading">Front Office</div>
              <div className="ts-fo-list">
                <div className="ts-fo-row"><span>Coach{team.coach ? ` · ${team.coach.archetype}` : ''}</span><span>{team.coach ? team.coach.modifier : '—'}</span></div>
                <div className="ts-fo-row"><span>Fanbase</span><span>{team.fanbaseArchetype ? team.fanbaseArchetype.name : '—'}</span></div>
                <div className="ts-fo-row"><span>Market</span><span>{team.market ? team.market.name : '—'}</span></div>
              </div>
              <div className="ts-metrics">
                <div><div className="ts-metric-label">Chemistry</div><div className="ts-metric-value">{chemistry !== null ? chemistry : '—'}</div></div>
                <div><div className="ts-metric-label">Proj Off</div><div className="ts-metric-value accent">{output ? output.total : '—'}</div></div>
              </div>
            </div>
          </div>
        </div>

        {team.lineupConfirmed && waitingOn.length > 0 && (
          <div className="statusline" style={{ marginTop: 16 }}>Season locked — waiting on {waitingOn.map((t) => t.name).join(', ')}…</div>
        )}
      </div>
      <div className="bottombar">
        <button
          className="primary"
          disabled={team.lineupConfirmed}
          onClick={() => {
            const res = actions.confirmLineup(myTeamId);
            if (res && res.valid === false) alert(res.msg);
          }}
        >
          {team.lineupConfirmed ? 'Waiting…' : 'Begin Season'}
        </button>
      </div>
    </>
  );
}
