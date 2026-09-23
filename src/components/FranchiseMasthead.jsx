import { useState } from 'react';
import { teamSynergy } from '../game/skillsets';
import { teamOutput } from '../game/matchup';
import { modifierBreakdown, offenseDieSize, defenseDieSize } from '../game/roster';
import { ERA_LENGTH } from '../game/constants';
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const pct = (n) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;

// Each metric's value is a small stack of separately-tuned numbers (roster stats, coach bonus,
// chemistry, synergy, an expected die roll, …) that nothing on this screen otherwise explains —
// tapping a metric shows exactly what added up to it, using the same breakdown math the live
// roll popover uses (game/roster.js's modifierBreakdown) rather than a second, drifting copy of it.
function breakdownRows(kind, team, synergy, output) {
  if (kind === 'chemistry') {
    return [
      ['Base', 50],
      ['Skillset Fit', `+${synergy.fitPoints}`],
      ['Continuity', `+${synergy.tenurePoints}`],
      ['Leadership', `+${synergy.leadershipPoints}`],
      ['__total', `${synergy.score} (${synergy.grade})`],
    ];
  }
  if (kind === 'output') {
    return [
      ['Offense', output.off],
      ['Defense', output.def],
      ['Bench', output.bench],
      ['__total', output.total],
    ];
  }
  const isOff = kind === 'offense';
  const b = modifierBreakdown(team, team.activeIds, kind);
  const dieAvg = Math.round(((isOff ? offenseDieSize(team) : defenseDieSize(team)) + 1) / 2 * 100) / 100;
  const rows = [[isOff ? 'SCO + PLM' : 'DEF + REB', b.statSum], ['Coach Bonus', pct(b.coachBonus)]];
  if (b.retention !== 0) rows.push(['Retention', pct(b.retention)]);
  if (b.relationship !== 0) rows.push(['Relationships', pct(b.relationship)]);
  if (b.handsOff !== 0) rows.push(['GM Approach', pct(b.handsOff)]);
  if (b.gameplan !== 0) rows.push(['Gameplan', pct(b.gameplan)]);
  rows.push(['Roster Base', b.preSynergyBase]);
  if (b.synergyPct !== 0) rows.push(['Skillset Synergy', `${b.synergyPct >= 0 ? '+' : ''}${b.synergyPct}%`]);
  rows.push(['Roster Mod', b.base]);
  rows.push(['Expected Roll', `+${dieAvg}`]);
  rows.push(['__total', isOff ? output.off : output.def]);
  return rows;
}

const METRIC_LABELS = { chemistry: 'Chemistry', output: 'Output', offense: 'Offense', defense: 'Defense' };

export default function FranchiseMasthead({ state, teamId }) {
  const team = state.teams[teamId];
  const [openMetric, setOpenMetric] = useState(null);
  if (!team) return null;
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  const synergy = teamSynergy(team);
  const output = team.coach && team.activeIds?.length ? teamOutput(team) : null;
  const outputs = state.teams.map((t) => (t.coach && t.activeIds?.length ? teamOutput(t) : null));
  const rankedCount = outputs.filter(Boolean).length;
  const rankFor = (key) => output ? outputs.filter((o) => o && o[key] > output[key]).length + 1 : null;

  const toggleMetric = (kind) => () => setOpenMetric((v) => (v === kind ? null : kind));
  const rows = openMetric && output ? breakdownRows(openMetric, team, synergy, output) : null;

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
        <button type="button" className={'ts-hero-metric chemistry' + (openMetric === 'chemistry' ? ' open' : '')} onClick={toggleMetric('chemistry')}><div className="ts-proj-label">Chemistry</div><div className="ts-hero-value">{synergy.grade}</div><div className="ts-proj-rank">{synergy.score}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'output' ? ' open' : '')} onClick={output ? toggleMetric('output') : undefined} disabled={!output}><div className="ts-proj-label">Output</div><div className="ts-hero-value accent">{output ? output.total : '—'}</div><div className="ts-proj-rank">{output ? `${ordinal(rankFor('total'))} of ${rankedCount}` : '—'}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'offense' ? ' open' : '')} onClick={output ? toggleMetric('offense') : undefined} disabled={!output}><div className="ts-proj-label">Offense</div><div className="ts-hero-value">{output ? output.off : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('off')) : '—'}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'defense' ? ' open' : '')} onClick={output ? toggleMetric('defense') : undefined} disabled={!output}><div className="ts-proj-label">Defense</div><div className="ts-hero-value">{output ? output.def : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('def')) : '—'}</div></button>
      </div>
      {rows && (
        <div className="ts-masthead-breakdown">
          <div className="ts-masthead-breakdown-head">{team.name} — {METRIC_LABELS[openMetric]}</div>
          {rows.map(([label, value], i) => label === '__total'
            ? <div className="ts-masthead-breakdown-row total" key={i}><span>Total</span><span>{value}</span></div>
            : <div className="ts-masthead-breakdown-row" key={i}><span>{label}</span><span>{value}</span></div>)}
        </div>
      )}
    </div>
  );
}
