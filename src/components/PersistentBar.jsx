// Compact mobile card tray. Team metrics live in the persistent franchise masthead.
import { forwardRef } from 'react';
import CardTypeMark from './CardTypeMark';

const PersistentBar = forwardRef(function PersistentBar({ state, myTeamId, onNavigate, dealProgress }, ref) {
  const team = state.teams[myTeamId];
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  // Front Office deals in a fixed [coach, fanbase, market] order, but fanbase is skipped
  // entirely (see DealScreen's own FO_KINDS) when Fanbase Cards is off for this era — only 2
  // Front Office cards land, not always 3, or dealProgress never reaches the old hardcoded
  // threshold and Gameplan/Adjustment stay stuck reporting 0 for the rest of pullhand (same fix
  // as DesktopBar's foTotal, missed here originally).
  const foTotal = state.settings.fanbaseCardsEnabled !== false ? 3 : 2;
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawHand.length + foTotal + (team.matchupCards || []).length;
  const coachDealt = !inDeal || (dealProgress ?? 0) > rawHand.length;
  const available = (cards) => (fullyDealt ? (cards || []).filter((card) => !card.used).length : 0);
  const activeGameplan = (team.gameplanCards || []).find((c) => c.used);

  return (
    <div className="persistent-bar" ref={ref}>
      <button className="persistent-bar-section persistent-bar-coach" onClick={() => onNavigate('office')}>
        <span>Coach{activeGameplan && <span className="persistent-bar-gameplan-active" title={`${activeGameplan.name} is active`}><CardTypeMark type="gameplan" size={12} color="var(--franchise)" /></span>}</span>
        <b>{coachDealt ? team.coach?.archetype || 'Open Slot' : 'Pending'}</b>
        {coachDealt && team.coach && <small>{team.coach.modifier}</small>}
      </button>
      <button className="persistent-bar-section persistent-card-count gameplan" onClick={() => onNavigate('gameplan')} aria-label="Gameplan"><CardTypeMark type="gameplan" size={16} /><b>{available(team.gameplanCards)}</b></button>
      <button className="persistent-bar-section persistent-card-count adjustment" onClick={() => onNavigate('adjustment')} aria-label="Adjustment"><CardTypeMark type="adjustment" size={16} /><b>{available(team.matchupCards)}</b></button>
    </div>
  );
});

export default PersistentBar;
