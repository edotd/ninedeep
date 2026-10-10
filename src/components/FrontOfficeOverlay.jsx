import { useEffect, useState } from 'react';
import FrontOfficeCard from './FrontOfficeCard';
import { formatCoins, gmCost } from '../game/economy';

// The Coach / GM card shown full screen from the bottom bar's matching slot: it grows out of
// that slot, and tapping the (highlighted) slot again shrinks it back. The overlay stops above
// the bar so the slot stays tappable. Carries the same fire actions the old Team sub pages had.
const OUT_MS = 260;

export default function FrontOfficeOverlay({ state, actions, myTeamId, which, leaving }) {
  const team = state.teams[myTeamId];
  const [scale, setScale] = useState(1.2);
  // Fill the width (the card is 300px wide at 1x) without growing past what fits.
  useEffect(() => {
    const fit = () => setScale(Math.max(0.9, Math.min(1.3, (window.innerWidth - 24) / 300)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  if (!team) return null;
  const isCoach = which === 'coach';
  const fireCoachDeadCap = team.coach ? Math.round((team.coach.salary / 2) * 100) / 100 : 0;
  const canChange = state.settings.coachChangesEnabled;
  const run = (res) => { if (res && res.ok === false) alert(res.msg); };
  return (
    <div className={'fo-overlay ' + which + (leaving ? ' leaving' : '')} role="dialog" aria-label={isCoach ? 'Coach card' : 'GM card'}>
      <div className="fo-overlay-body" style={{ '--fo-scale': scale }}>
        {isCoach
          ? (team.coach ? <FrontOfficeCard kind="coach" team={team} /> : <div className="ts-empty-coach"><span>Coach</span><strong>Open Slot</strong><small>Choose a replacement in Free Agency.</small></div>)
          : <FrontOfficeCard kind="market" team={team} />}
      </div>
      <div className="fo-overlay-actions">
        {canChange && isCoach && team.coach && (
          <button type="button" className="secondary fo-overlay-action" onClick={() => run(actions.fireCoach(myTeamId))}>Fire Coach ({formatCoins(fireCoachDeadCap)})</button>
        )}
        {canChange && !isCoach && team.gmType && (
          <button type="button" className="secondary fo-overlay-action" disabled={team.gmChangeSeason === state.season} onClick={() => run(actions.fireGM(myTeamId))}>
            {team.gmChangeSeason === state.season ? 'GM Replaced This Season' : `Fire GM (${formatCoins(Math.round((gmCost(team.gmType) / 2) * 100) / 100)})`}
          </button>
        )}
        <div className="fo-overlay-hint">Tap {isCoach ? 'Coach' : 'GM'} below to close</div>
      </div>
    </div>
  );
}

export { OUT_MS };
