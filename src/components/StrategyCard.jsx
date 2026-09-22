export default function StrategyCard({ card, children, compact = false }) {
  const label = card.kind === 'development' ? 'Development' : 'Gameplan';
  const active = card.kind === 'gameplan' && card.used;
  return (
    <div className={`strategy-card ${card.kind}${active ? ' active' : card.used ? ' used' : ''}${compact ? ' compact' : ''}`}>
      <div className="strategy-card-kicker">{label}{active ? ' · Active' : card.used ? ' · Used' : ''}</div>
      <div className="strategy-card-name">{card.name}</div>
      <div className="strategy-card-description">{card.description}</div>
      {card.kind === 'development' && <div className="strategy-card-rule">One per player career</div>}
      {children && <div className="strategy-card-actions">{children}</div>}
    </div>
  );
}
