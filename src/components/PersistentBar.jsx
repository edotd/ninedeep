import { teamSynergy } from '../game/skillsets';
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
  // The hand is written to state the instant Hand's own screen mounts, before its one-by-one
  // reveal animation finishes — the bar has to deliberately ignore it while that reveal is
  // still the active phase, or the rotation strip would show 9/9 while the screen behind it
  // is still dealing card by card. Same idea front office/matchup rely on in DesktopBar.
  const handRevealed = state.phase !== 'pullhand';
  const hand = handRevealed ? (team.hand || []) : [];
  const activeIds = handRevealed ? (team.activeIds || []) : [];

  const canShowOutput = team.coach && hand.length > 0 && activeIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const synergy = teamSynergy(team);
  const chemistry = teamExperience(team);
  const cap = team.seasonCap;
  const salary = hand.length ? rosterSalary(team) : 0;
  const overBudget = cap !== undefined && salary > cap;
  const deadCap = (team.deadCap || []).reduce((s, c) => s + c.amount, 0);
  const bonus = (value, side) => value > 0 ? `+${value}% ${side}` : `N/A ${side}`;

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
        <div className="persistent-bar-metric-value">{chemistry !== null ? synergy.grade : '—'}</div>
        <div className="chemistry-bar-detail">{synergy.score}/100 · {bonus(synergy.offense, 'OFF')} · {bonus(synergy.defense, 'DEF')}</div>
      </div>
      <div className="persistent-bar-metric">
        <div className="persistent-bar-metric-label">Budget</div>
        <div className={'persistent-bar-metric-value' + (overBudget ? ' over-budget' : '')}>{cap !== undefined ? `${formatCoins(salary).replace('🪙', '🪙 ')} / ${formatCoins(cap).replace('🪙', '')}` : '—'}</div>
        {deadCap > 0 && <div className="persistent-budget-owed">(+{deadCap} Dead Cap)</div>}
      </div>
      <div className="persistent-bar-metric">
        <div className="persistent-bar-metric-label">Proj. Output</div>
        <div className="persistent-bar-metric-value accent">{output ? output.total : '—'}</div>
      </div>
      <div className="persistent-bar-chevron">▴</div>
    </div>
  );
}
