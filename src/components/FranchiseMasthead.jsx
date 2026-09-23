import { teamSynergy } from '../game/skillsets';
import { benchScore, teamOutput } from '../game/matchup';
import { ERA_LENGTH } from '../game/constants';
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function FranchiseMasthead({ state, teamId }) {
  const team = state.teams[teamId];
  if (!team) return null;
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  const synergy = teamSynergy(team);
  const output = team.coach && team.activeIds?.length ? teamOutput(team) : null;
  const outputs = state.teams.map((t) => (t.coach && t.activeIds?.length ? teamOutput(t) : null));
  const rankedCount = outputs.filter(Boolean).length;
  const rankFor = (key) => output ? outputs.filter((o) => o && o[key] > output[key]).length + 1 : null;
  const bench = team.activeIds?.length ? benchScore(team) : null;

  return (
    <div className="ts-masthead persistent-franchise-masthead">
      <div className="ts-masthead-left">
        <div className="ts-masthead-label">FRANCHISE FILE{team.market ? ` · ${team.market.name.toUpperCase()}` : ''}</div>
        <div className="ts-masthead-name">{team.name}</div>
        <div className="ts-franchise-history">
          <div className="ts-era">
            <div className="ts-era-label">ERA 01 · YR {seasonNum} OF {ERA_LENGTH}</div>
            <div className="ts-era-bar">{Array.from({ length: ERA_LENGTH }, (_, i) => <div key={i} className={'ts-era-seg' + (i < seasonNum ? ' done' : '')} />)}</div>
          </div>
          <div className="ts-titles"><div className="ts-titles-value">{team.titles}</div><div className="ts-titles-label">CHAMPIONSHIP{team.titles === 1 ? '' : 'S'}</div></div>
        </div>
      </div>
      <div className="ts-masthead-right persistent">
        <div className="ts-hero-metric chemistry"><div className="ts-proj-label">Chemistry</div><div className="ts-hero-value">{synergy.grade}</div><div className="ts-proj-rank">{synergy.score}</div></div>
        <div className="ts-hero-metric"><div className="ts-proj-label">Output</div><div className="ts-hero-value accent">{output ? output.total : '—'}</div><div className="ts-proj-rank">{output ? `${ordinal(rankFor('total'))} of ${rankedCount}` : '—'}</div></div>
        <div className="ts-hero-metric"><div className="ts-proj-label">Offense</div><div className="ts-hero-value">{output ? output.off : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('off')) : '—'}</div></div>
        <div className="ts-hero-metric"><div className="ts-proj-label">Defense</div><div className="ts-hero-value">{output ? output.def : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('def')) : '—'}</div></div>
        <div className="ts-hero-metric"><div className="ts-proj-label">Bench</div><div className="ts-hero-value">{bench ?? '—'}</div><div className="ts-proj-rank">Output</div></div>
      </div>
    </div>
  );
}
