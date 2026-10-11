import BonusIcon from './BonusIcon';

// The lineup page's active bonuses as one row of icons (pairings, stat and position bonuses,
// Floor Balance, Wise Veteran). Tapping one highlights where it comes from on the court and opens
// a short description above the row; tapping it again closes it.
export default function LineupPairingsRow({ bonuses, selected, onSelect }) {
  const open = bonuses.find((bonus) => bonus.name === selected) || null;
  return (
    <div className="lineup-pairings-row" role="group" aria-label="Active pairings">
      {open && (
        <div className="lineup-pairings-pop" role="status">
          <b>{open.name}</b>
          <em>{open.value}</em>
          {open.detail && <small>{open.detail}</small>}
        </div>
      )}
      <span className="lineup-pairings-label">Pairings</span>
      <span className="lineup-pairings-icons">
        {bonuses.length ? bonuses.map((bonus) => (
          <button
            type="button"
            key={bonus.name}
            className={'lineup-pairings-icon' + (selected === bonus.name ? ' on' : '')}
            aria-pressed={selected === bonus.name}
            aria-label={`${bonus.name}, ${bonus.value}`}
            onClick={() => onSelect?.(bonus.name)}
          ><BonusIcon name={bonus.name} size={40} /></button>
        )) : <em>None active</em>}
      </span>
    </div>
  );
}
