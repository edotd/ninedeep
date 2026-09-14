import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier } from '../game/cards';

// Collapsed mobile persistent bar, per the brand handoff's "Component: Persistent Bar" —
// the team, permanently in view, fixed above whatever screen-specific action is showing.
// Tapping it never navigates away; it raises the Team overlay (already wired to the header's
// Team button) on top of the current screen, so the bar itself never loses its place.
export default function PersistentBar({ state, myTeamId, onExpand }) {
  const team = state.teams[myTeamId];
  const hand = team.hand || [];
  const activeIds = team.activeIds || [];

  const canShowOutput = team.coach && hand.length > 0 && activeIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const chemistry = teamExperience(team);
  const cap = team.seasonCap;
  const salary = hand.length ? rosterSalary(team) : 0;

  const slots = Array.from({ length: 9 }, (_, i) => {
    const card = hand[i];
    if (!card) return 'empty';
    if (cardTier(card) === 'EXP') return 'expiring';
    return activeIds.includes(card.id) ? 'starter' : 'bench';
  });

  return (
    <div className="persistent-bar" onClick={onExpand}>
      <div className="persistent-bar-rotation">
        <span className="persistent-bar-rotation-label">Rotation {hand.length}/9</span>
        <div className="persistent-bar-rotation-grid">
          {slots.map((s, i) => <div key={i} className={'persistent-bar-dot' + (s !== 'empty' ? ' ' + s : '')} />)}
        </div>
      </div>
      <div className="persistent-bar-metric">
        <div className="persistent-bar-metric-label">Chemistry</div>
        <div className="persistent-bar-metric-value">{chemistry !== null ? chemistry : '—'}</div>
      </div>
      <div className="persistent-bar-metric">
        <div className="persistent-bar-metric-label">Cap</div>
        <div className="persistent-bar-metric-value">{cap !== undefined ? `${formatCoins(salary)} / ${formatCoins(cap)}` : '—'}</div>
      </div>
      <div className="persistent-bar-metric">
        <div className="persistent-bar-metric-label">Proj. Output</div>
        <div className="persistent-bar-metric-value accent">{output ? output.total : '—'}</div>
      </div>
      <div className="persistent-bar-chevron">▴</div>
    </div>
  );
}
