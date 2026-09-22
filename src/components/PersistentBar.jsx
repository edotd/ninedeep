import { teamSynergy } from '../game/skillsets';
import { formatCoins, rosterSalary } from '../game/economy';
import { teamOutput } from '../game/matchup';
import { teamExperience } from '../game/aging';
import { cardTier } from '../game/cards';

// Collapsed mobile persistent bar, per the brand handoff's "Component: Persistent Bar" —
// the team, permanently in view, fixed above whatever screen-specific action is showing.
// Tapping it never navigates away; it raises the Team overlay (already wired to the header's
// Team button) on top of the current screen, so the bar itself never loses its place.
export default function PersistentBar({ state, myTeamId, onExpand, dealProgress }) {
  const team = state.teams[myTeamId];
  // The hand is written to state the instant DealScreen mounts, before its one-by-one reveal
  // animation finishes — the bar has to deliberately ignore cards not yet dealt, or the
  // rotation strip would show 9/9 while the screen behind it is still dealing card by card.
  // dealProgress (lifted in GameShell, counted up by DealScreen) says how many hand cards have
  // actually landed so far while state.phase is 'pullhand'; every other phase shows the full
  // hand, same as before. Same idea front office/matchup rely on in DesktopBar.
  const inDeal = state.phase === 'pullhand';
  const rawHand = team.hand || [];
  const rawActiveIds = team.activeIds || [];
  // Same starters-then-bench order DealScreen deals in, so the dot grid fills left to right in
  // the order cards actually land, not team.hand's own (unrelated) storage order.
  const orderedHand = rawActiveIds.map((id) => rawHand.find((c) => c.id === id)).filter(Boolean)
    .concat(rawHand.filter((c) => !rawActiveIds.includes(c.id)));
  const handRevealCount = inDeal ? Math.max(0, Math.min(orderedHand.length, dealProgress ?? 0)) : orderedHand.length;
  const hand = orderedHand.slice(0, handRevealCount);
  const activeIds = rawActiveIds;
  const fullyDealt = !inDeal || (dealProgress ?? 0) >= rawHand.length + 3 + (team.matchupCards || []).length;

  const canShowOutput = fullyDealt && team.coach && rawHand.length > 0 && rawActiveIds.length > 0;
  const output = canShowOutput ? teamOutput(team) : null;
  const synergy = teamSynergy(team);
  const chemistry = fullyDealt ? teamExperience(team) : null;
  const cap = fullyDealt ? team.seasonCap : undefined;
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
