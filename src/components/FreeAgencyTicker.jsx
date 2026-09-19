export default function FreeAgencyTicker({ activity = [], withBar = false }) {
  const items = activity.slice(0, 12);
  return (
    <section className={'fa-ticker persistent-ticker' + (items.length ? '' : ' idle') + (withBar ? ' with-bar' : '')} aria-label="Free agency activity">
      <div className="fa-ticker-label">Free Agency Wire</div>
      <div className="fa-ticker-window">
        {items.length ? <div className="fa-ticker-track">
          {[...items, ...items].map((item, i) => (
            <span className="fa-ticker-item" key={`${item.id}-${i}`}>
              <b>{item.type === 'released' ? 'RELEASED' : 'SIGNED'}</b>
              {item.player} · {item.grade} · {item.position}
              {item.teamName && <em>{item.type === 'released' ? `from ${item.teamName}` : `by ${item.teamName}`}</em>}
            </span>
          ))}
        </div> : <span className="fa-ticker-empty">No player movement</span>}
      </div>
    </section>
  );
}
