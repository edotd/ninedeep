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

// Only offense/defense breakdowns include an Expected Roll row — chemistry and output don't
// roll a die at all, so there's nothing there to explain.
const BREAKDOWN_NOTES = {
  offense: 'Expected Roll is the statistical average of your offense die — (die size + 1) ÷ 2 — used here to project output before any match happens. A real roll can land higher or lower.',
  defense: 'Expected Roll is the statistical average of your defense die — (die size + 1) ÷ 2 — used here to project output before any match happens. A real roll can land higher or lower.',
};

export default function FranchiseMasthead({ state, teamId }) {
  const team = state.teams[teamId];
  const [openMetric, setOpenMetric] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  if (!team) return null;
  const seasonNum = Math.min(state.season, ERA_LENGTH);
  // A human team's chemistry/output/offense/defense are only meaningful once they've actually
  // reviewed a lineup on the Set Lineup screen — before that, the auto-selected five is a
  // placeholder, not a real projection. AI teams have no such review step (lineupSet is set
  // true for them the moment autoSelectFive runs), so they're never gated here.
  const lineupReady = team.coach && team.activeIds?.length === 5 && team.lineupSet;
  const synergy = lineupReady ? teamSynergy(team) : null;
  const output = lineupReady ? teamOutput(team) : null;
  const outputs = state.teams.map((t) => (t.coach && t.activeIds?.length === 5 && t.lineupSet ? teamOutput(t) : null));
  const rankedCount = outputs.filter(Boolean).length;
  const rankFor = (key) => output ? outputs.filter((o) => o && o[key] > output[key]).length + 1 : null;

  const toggleMetric = (kind) => () => {
    setSelectedRow(null);
    setOpenMetric((v) => (v === kind ? null : kind));
  };
  const rows = openMetric && lineupReady ? breakdownRows(openMetric, team, synergy, output) : null;

  const rowExplanation = (label) => {
    const explanations = {
      Base: 'Every franchise begins with 50 chemistry points before roster fit, continuity, and leadership are counted.',
      'Skillset Fit': 'Points created by complementary skillsets in the starting five.',
      Continuity: 'Chemistry earned by keeping players together across seasons.',
      Leadership: 'Chemistry supplied by veteran leadership effects on the roster.',
      Offense: 'The offense portion of projected output, including player stats, bonuses, and the expected offense roll.',
      Defense: 'The defense portion of projected output, including player stats, bonuses, and the expected defense roll.',
      Bench: 'The fixed contribution supplied by the four players outside the starting five.',
      'SCO + PLM': 'The starting five’s scoring and playmaking stats form the raw offense foundation.',
      'DEF + REB': 'The starting five’s defense and rebounding stats form the raw defense foundation.',
      'Coach Bonus': `The coach’s ${openMetric} specialty changes the roster’s base value by this percentage.`,
      Retention: 'A continuity bonus earned by retaining the coach or starting five.',
      Relationships: 'Bonuses and penalties created by player relationships and roster effects.',
      'GM Approach': 'The active GM type changes this side of the team through its continuity rules.',
      Gameplan: 'The active Gameplan card applies this temporary percentage change.',
      'Roster Base': 'The roster’s value after percentage modifiers and before skillset synergy.',
      'Skillset Synergy': 'The percentage added by compatible starter skillsets and chemistry effects.',
      'Roster Mod': 'The final roster modifier applied before the die roll.',
      'Expected Roll': `The statistical average of the ${openMetric} die: (die size + 1) ÷ 2. Actual rolls can land higher or lower.`,
      Total: openMetric === 'output'
        ? 'Projected Output is the sum of offense, defense, and bench contribution.'
        : openMetric === 'chemistry'
          ? 'The final chemistry score determines the displayed letter grade.'
          : `The final projected ${openMetric} value combines the roster modifier and expected die roll.`,
    };
    return explanations[label];
  };

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
        <button type="button" className={'ts-hero-metric chemistry' + (openMetric === 'chemistry' ? ' open' : '')} onClick={synergy ? toggleMetric('chemistry') : undefined} disabled={!synergy}><div className="ts-proj-label">Chemistry</div><div className="ts-hero-value">{synergy ? synergy.grade : '—'}</div><div className="ts-proj-rank">{synergy ? synergy.score : '—'}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'output' ? ' open' : '')} onClick={output ? toggleMetric('output') : undefined} disabled={!output}><div className="ts-proj-label">Output</div><div className="ts-hero-value accent">{output ? output.total : '—'}</div><div className="ts-proj-rank">{output ? `${ordinal(rankFor('total'))} of ${rankedCount}` : '—'}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'offense' ? ' open' : '')} onClick={output ? toggleMetric('offense') : undefined} disabled={!output}><div className="ts-proj-label">Offense</div><div className="ts-hero-value">{output ? output.off : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('off')) : '—'}</div></button>
        <button type="button" className={'ts-hero-metric' + (openMetric === 'defense' ? ' open' : '')} onClick={output ? toggleMetric('defense') : undefined} disabled={!output}><div className="ts-proj-label">Defense</div><div className="ts-hero-value">{output ? output.def : '—'}</div><div className="ts-proj-rank">{output ? ordinal(rankFor('def')) : '—'}</div></button>
      </div>
      {rows && (
        <div className="ts-masthead-breakdown">
          <div className="ts-masthead-breakdown-head">{team.name} — {METRIC_LABELS[openMetric]}</div>
          {rows.map(([rawLabel, value], i) => {
            const label = rawLabel === '__total' ? 'Total' : rawLabel;
            return <button type="button" className={'ts-masthead-breakdown-row' + (rawLabel === '__total' ? ' total' : '') + (selectedRow === label ? ' selected' : '')} key={i} onClick={() => setSelectedRow(label)}><span>{label}</span><span>{value}</span></button>;
          })}
          <p className="ts-masthead-breakdown-note">{selectedRow ? rowExplanation(selectedRow) : (BREAKDOWN_NOTES[openMetric] || 'Select a row to learn how it contributes to this total.')}</p>
        </div>
      )}
    </div>
  );
}
