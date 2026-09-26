export default function PlayerFilterBar({ sort, onChange }) {
  return (
    <div className="player-filter-bar player-sort-bar">
      <select aria-label="Sort players" value={sort} onChange={(event) => onChange(event.target.value)}>
        <option value="position">Sort: Position</option>
        <option value="grade">Sort: Grade</option>
        <option value="SCO">Sort: SCO</option>
        <option value="PLM">Sort: PLM</option>
        <option value="REB">Sort: REB</option>
        <option value="DEF">Sort: DEF</option>
        <option value="rarity">Sort: Rarity</option>
        <option value="archetype">Sort: Archetype</option>
      </select>
    </div>
  );
}
