import { skillsetFor } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';

// The "Coach In Front" match-flow tile, per the design doc's 8A layout — a much denser card
// than the full PlayerCard, sized to line an entire nine-card rotation up in one row: an
// accent header bar (position + grade), jersey + role/status, one skillset tag, then a stat
// grid. `edge` puts the orange accent border on whichever side faces the shared roll zone
// (bottom for the top team, top for the bottom team), matching the design's "in front of the
// rotation" framing.
const GRADE_TONE = { 'A+': 'var(--approved)', A: 'var(--approved)', B: 'var(--ink)', C: 'var(--stamp)', D: 'var(--stamp)', F: 'var(--stamp)' };

export default function CompactPlayerTile({ card, isStarter, edge = 'bottom', contributing }) {
  const grade = playerGrade(card);
  const skillset = skillsetFor(card);
  return (
    <div className={'nd2-tile' + (edge === 'top' ? ' edge-top' : ' edge-bottom') + (contributing ? ' contributing' : '')}>
      <div className="nd2-tile-head">
        <span>{card.archetype}</span>
        <span style={{ color: GRADE_TONE[grade] || 'var(--ink)' }}>{grade}</span>
      </div>
      <div className="nd2-tile-body">
        <div className="nd2-tile-jersey">#{jerseyNumber(card)}</div>
        <div className="nd2-tile-role">
          <div className="nd2-tile-pos">{card.position}</div>
          <div className="nd2-tile-status">{isStarter ? 'Starter' : 'Bench'}</div>
        </div>
      </div>
      <div className="nd2-tile-tags">
        <span className="nd2-tile-tag">{skillset?.name || 'No Skillset'}</span>
      </div>
      <div className="nd2-tile-stats">
        <div className="nd2-tile-stat"><b>{card.stats.SCO}</b><span>SCO</span></div>
        <div className="nd2-tile-stat"><b>{card.stats.PLM}</b><span>PLM</span></div>
        <div className="nd2-tile-stat"><b>{card.stats.REB}</b><span>REB</span></div>
        <div className="nd2-tile-stat"><b>{card.stats.DEF}</b><span>DEF</span></div>
      </div>
    </div>
  );
}
