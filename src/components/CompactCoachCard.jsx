import { retentionBonus, relationshipBonus } from '../game/cards';

// The "Head Coach" card from the Match Flow design's 8A layout — set in front of the rotation,
// overlapping the boundary between the roster and the team name. Much smaller than the full
// FrontOfficeCard used on the team-overview screens: just the coach's archetype, modifier, and
// a single "System Bonus" figure (the larger of the two live off/def bonuses, real percentages
// rather than the design's flavor "+2").
export default function CompactCoachCard({ team, edge = 'bottom' }) {
  const coach = team.coach;
  const bonus = retentionBonus(team) + relationshipBonus(team);
  const offPct = Math.round((coach.offBonus + bonus) * 100);
  const defPct = Math.round((coach.defBonus + bonus) * 100);
  const systemBonus = Math.max(offPct, defPct);
  return (
    <div className={'nd2-coach' + (edge === 'top' ? ' edge-top' : ' edge-bottom')}>
      <div className="nd2-coach-head">
        <span>Head Coach</span>
        <span>{coach.modifier}</span>
      </div>
      <div className="nd2-coach-body">
        <div className="nd2-coach-name">{coach.archetype}</div>
        <div className="nd2-coach-desc">Off +{offPct}% · Def +{defPct}%</div>
      </div>
      <div className="nd2-coach-foot">
        <span>System Bonus</span>
        <b>+{systemBonus}%</b>
      </div>
    </div>
  );
}
