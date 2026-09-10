import { formatCoins } from '../game/economy';

export default function PlayerCard({ card, onClick, selected, draftStyle, rosterLabel }) {
  const pillLabel = rosterLabel || (selected ? 'Selected' : null);
  const pillClass = rosterLabel === 'Bench' ? 'bench-pill' : 'active-pill';
  return (
    <div className={'card pos-' + card.position + (selected ? ' selected' : '')} onClick={onClick}>
      <div className="card-top">
        <div>
          <div className="card-name card-name-lg">{card.archetype}</div>
          <div className="card-sub">{card.position} · <span className="tier-pill">{card.tierName}</span></div>
        </div>
        <div className="pill-stack">
          {pillLabel && <div className={pillClass}>{pillLabel}</div>}
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat"><b>{card.stats.SCO}</b><span>Scoring</span></div>
        <div className="stat"><b>{card.stats.PLM}</b><span>Playmaking</span></div>
        <div className="stat"><b>{card.stats.REB}</b><span>Rebounding</span></div>
        <div className="stat"><b>{card.stats.DEF}</b><span>Defense</span></div>
      </div>
      {draftStyle ? (
        <div className="meta-row">
          <div style={{ flex: 1 }}>
            <div className="card-sub" style={{ marginBottom: 3 }}>Contract Requested</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{card.contract} Turn{card.contract === 1 ? '' : 's'}, {formatCoins(card.salary)} / 5</div>
          </div>
        </div>
      ) : (
        <div className="meta-row">
          <div className="meta-cell"><b>{card.contract} Turn{card.contract === 1 ? '' : 's'}</b><span>Contract</span></div>
          <div className="meta-cell"><b>{formatCoins(card.salary)}</b><span>Salary</span></div>
        </div>
      )}
    </div>
  );
}
