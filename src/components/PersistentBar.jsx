import { cardTier } from '../game/cards';

// Compact mobile card tray. Team metrics live in the persistent franchise masthead.
export default function PersistentBar({ state, myTeamId, onExpand, dealProgress }) {
  const team = state.teams[myTeamId];
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  const activeIds = team.activeIds || [];
  const orderedHand = activeIds.map((id) => rawHand.find((card) => card.id === id)).filter(Boolean)
    .concat(rawHand.filter((card) => !activeIds.includes(card.id)));
  const revealCount = inDeal ? Math.max(0, Math.min(orderedHand.length, dealProgress ?? 0)) : orderedHand.length;
  const hand = orderedHand.slice(0, revealCount);
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawHand.length + 3 + (team.matchupCards || []).length;
  const slots = Array.from({ length: 9 }, (_, i) => {
    const card = hand[i];
    if (!card) return 'empty';
    if (cardTier(card) === 'EXP') return 'expiring';
    return activeIds.includes(card.id) ? 'starter' : 'bench';
  });
  const available = (cards) => (fullyDealt ? (cards || []).filter((card) => !card.used).length : 0);

  return (
    <div className="persistent-bar" onClick={onExpand}>
      <div className="persistent-bar-rotation">
        <span className="persistent-bar-rotation-label">Rotation {hand.length}/9</span>
        <div className="persistent-bar-rotation-grid">{slots.map((slot, i) => <div key={i} className={'persistent-bar-dot' + (slot !== 'empty' ? ' ' + slot : '')} />)}</div>
      </div>
      <div className="persistent-card-count development"><span>Development</span><b>{available(team.developmentCards)}</b></div>
      <div className="persistent-card-count gameplan"><span>Gameplan</span><b>{available(team.gameplanCards)}</b></div>
      <div className="persistent-card-count adjustment"><span>Adjustment</span><b>{available(team.matchupCards)}</b></div>
      <div className="persistent-bar-chevron">▴</div>
    </div>
  );
}
