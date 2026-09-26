import { PLAYER_GRADES, PLAYER_ARCHETYPES, COST_BRACKETS, POSITIONS, RARITIES, playerFiltersActive } from '../game/playerFilters';

// A row of plain filter dropdowns shared by every screen that lets you browse a long list of
// player cards (the Set Lineup picker/bench and the Players tab) — Position/Grade/Rarity/
// Archetype/Cost, each defaulting to "All" so filtering is opt-in and changes nothing by default.
export default function PlayerFilterBar({ filters, onChange }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  return (
    <div className="player-filter-bar">
      <select aria-label="Filter by position" value={filters.position} onChange={set('position')}>
        <option value="All">Position: All</option>
        {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select aria-label="Filter by grade" value={filters.grade} onChange={set('grade')}>
        <option value="All">Grade: All</option>
        {PLAYER_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select aria-label="Filter by rarity" value={filters.rarity} onChange={set('rarity')}>
        <option value="All">Rarity: All</option>
        {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select aria-label="Filter by archetype" value={filters.archetype} onChange={set('archetype')}>
        <option value="All">Archetype: All</option>
        {PLAYER_ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select aria-label="Filter by cost" value={filters.cost} onChange={set('cost')}>
        <option value="All">Cost: All</option>
        {COST_BRACKETS.map((c) => <option key={c} value={c}>{'≤'}{c}</option>)}
      </select>
      {playerFiltersActive(filters) && (
        <button type="button" className="player-filter-clear" onClick={() => onChange({ position: 'All', grade: 'All', rarity: 'All', archetype: 'All', cost: 'All' })}>Clear</button>
      )}
    </div>
  );
}
