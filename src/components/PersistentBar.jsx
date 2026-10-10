// Compact mobile card tray. Team metrics live in the persistent franchise masthead.
import { forwardRef } from 'react';
import CardTypeMark from './CardTypeMark';
import ResourceChip from './ResourceChip';
import { matchupCardCountFor } from '../game/roster';
import { scoutingLimit } from '../game/gm';
import { formatCoins, remainingCap } from '../game/economy';

// Coach/Gameplan/Adjustment only mean something while there's a live season roster to manage —
// during Contracts/Draft (and whenever the Free Agency overlay is open, regardless of the
// underlying phase), the cap is the number that actually matters, so the bar's own right-hand
// slot swaps to it instead. Tapping either budget figure jumps straight to Free Agency, the
// one place those numbers change.
const CAP_FOCUSED_PHASES = new Set(['contracts', 'draft']);

const PersistentBar = forwardRef(function PersistentBar({ state, myTeamId, overlay, officeOpen, onToggleOffice, onNavigate, onFreeAgency, freeAgencyLocked, dealProgress }, ref) {
  const team = state.teams[myTeamId];
  const capFocused = CAP_FOCUSED_PHASES.has(state.phase) || overlay === 'freeagency';
  if (capFocused) {
    const room = remainingCap(team);
    return (
      <div className="persistent-bar persistent-bar-capfocus" ref={ref}>
        <button type="button" className={'persistent-bar-section persistent-bar-budget' + (room < 0 ? ' over' : '')} onClick={onFreeAgency} disabled={freeAgencyLocked}>
          <span>Room Available</span>
          <b>{formatCoins(room)}</b>
        </button>
        <button type="button" className="persistent-bar-section persistent-bar-budget" onClick={onFreeAgency} disabled={freeAgencyLocked}>
          <span>Total Budget</span>
          <b>{formatCoins(team.seasonCap || 0)}</b>
        </button>
      </div>
    );
  }
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
  const activeGameplan = team.coach?.gameplans?.find((plan) => plan.id === team.activeGameplanId);

  return (
    <div className="persistent-bar" ref={ref}>
      <button className={'persistent-bar-section persistent-bar-coach' + (officeOpen === 'coach' ? ' on' : '')} aria-pressed={officeOpen === 'coach'} onClick={() => (onToggleOffice ? onToggleOffice('coach') : onNavigate('office'))}>
        <span className="persistent-bar-box-heading"><CardTypeMark type="frontoffice" size={24} color="var(--franchise)" /> Coach{activeGameplan && <span className="persistent-bar-gameplan-active" title={`${activeGameplan.name} is active`} />}</span>
        {coachDealt && team.coach && (
          <span className="res-chips">
            <ResourceChip kind="development" count={team.developmentPoints ?? 0} />
            <ResourceChip kind="adjustments" count={matchupCardCountFor(team)} />
          </span>
        )}
        <b>{coachDealt ? team.coach?.archetype?.replace(/ Minded$/, '') || 'Open Slot' : 'Pending'}</b>
        {coachDealt && team.coach && <small>{team.coach.modifier}</small>}
      </button>
      <button className={'persistent-bar-section persistent-bar-gm' + (officeOpen === 'gm' ? ' on' : '')} aria-pressed={officeOpen === 'gm'} onClick={() => (onToggleOffice ? onToggleOffice('gm') : onNavigate('office'))}>
        <span className="persistent-bar-box-heading"><CardTypeMark type="gm" size={24} color="var(--franchise)" /> GM</span>
        {fullyDealt && team.gmType && <span className="res-chips"><ResourceChip kind="scouts" count={scoutingLimit(team)} /></span>}
        <b>{fullyDealt ? (team.gmType ? team.gmTrait?.name || 'Neutral' : 'Open Slot') : 'Pending'}</b>
        {fullyDealt && team.gmType && <small>General Manager</small>}
      </button>
    </div>
  );
});

export default PersistentBar;
