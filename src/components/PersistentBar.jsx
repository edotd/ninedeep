// Compact mobile card tray. Team metrics live in the persistent franchise masthead.
export default function PersistentBar({ state, myTeamId, onNavigate, dealProgress }) {
  const team = state.teams[myTeamId];
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawHand.length + 3 + (team.matchupCards || []).length;
  const coachDealt = !inDeal || (dealProgress ?? 0) > rawHand.length;
  const available = (cards) => (fullyDealt ? (cards || []).filter((card) => !card.used).length : 0);

  return (
    <div className="persistent-bar">
      <button className="persistent-bar-section persistent-bar-coach" onClick={() => onNavigate('office')}>
        <span>Coach</span>
        <b>{coachDealt ? team.coach?.archetype || 'Open Slot' : 'Pending'}</b>
        {coachDealt && team.coach && <small>{team.coach.modifier}</small>}
      </button>
      <button className="persistent-bar-section persistent-card-count gameplan" onClick={() => onNavigate('gameplan')}><span>Gameplan</span><b>{available(team.gameplanCards)}</b></button>
      <button className="persistent-bar-section persistent-card-count adjustment" onClick={() => onNavigate('adjustment')}><span>Adjustment</span><b>{available(team.matchupCards)}</b></button>
    </div>
  );
}
