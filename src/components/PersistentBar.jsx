// Compact mobile card tray. Team metrics live in the persistent franchise masthead.
import { forwardRef } from 'react';
import CardTypeMark from './CardTypeMark';

const PersistentBar = forwardRef(function PersistentBar({ state, myTeamId, onNavigate, dealProgress }, ref) {
  const team = state.teams[myTeamId];
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawHand.length + 3 + (team.matchupCards || []).length;
  const coachDealt = !inDeal || (dealProgress ?? 0) > rawHand.length;
  const available = (cards) => (fullyDealt ? (cards || []).filter((card) => !card.used).length : 0);

  return (
    <div className="persistent-bar" ref={ref}>
      <button className="persistent-bar-section persistent-bar-coach" onClick={() => onNavigate('office')}>
        <span>Coach</span>
        <b>{coachDealt ? team.coach?.archetype || 'Open Slot' : 'Pending'}</b>
        {coachDealt && team.coach && <small>{team.coach.modifier}</small>}
      </button>
      <button className="persistent-bar-section persistent-card-count gameplan" onClick={() => onNavigate('gameplan')} aria-label="Gameplan"><CardTypeMark type="gameplan" size={16} /><b>{available(team.gameplanCards)}</b></button>
      <button className="persistent-bar-section persistent-card-count adjustment" onClick={() => onNavigate('adjustment')} aria-label="Adjustment"><CardTypeMark type="adjustment" size={16} /><b>{available(team.matchupCards)}</b></button>
    </div>
  );
});

export default PersistentBar;
