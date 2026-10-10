import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCoins } from '../game/economy';
import { DEVELOPMENT_STATS_BY_STYLE } from '../game/strategyCards';

// The menu a player card opens when tapped in a carousel: SELECT (only where the carousel can
// select, i.e. the lineup picker), DEVELOP (green, with the Development Points left), RELEASE
// (red) and LEARN MORE (the onboarding card screen). Develop/Release are locked unless `canEdit`.
export default function PlayerCardMenu({ card, team, actions, myTeamId, canEdit, readOnly = false, onSelect, selectLabel = 'Select', onLearn, onClose, onReleased }) {
  const [view, setView] = useState('main'); // 'main' | 'develop'
  const stats = DEVELOPMENT_STATS_BY_STYLE[team.coach?.archetype] || [];
  const points = team.developmentPoints || 0;
  const pointsText = `${points} ${points === 1 ? 'Point' : 'Points'} Remaining`;

  const release = () => {
    const years = card.contract;
    const dead = Math.round((card.salary / 2) * 100) / 100;
    const note = years <= 0
      ? 'Their contract is already expired, so this leaves no dead cap.'
      : `Leaves ${formatCoins(dead)} in dead cap against your budget ${years === 1 ? 'this season' : `for each of the next ${years} seasons, starting this season`}.`;
    if (!window.confirm(`Release ${card.archetype} · ${card.position}? ${note}`)) return;
    const res = actions.releasePlayer(myTeamId, card.id);
    if (res && res.ok === false) { alert(res.msg); return; }
    onClose();
    onReleased?.(card);
  };
  const develop = (stat) => {
    const res = actions.applyDevelopmentPoint(myTeamId, card.id, stat);
    if (res && res.ok === false) { alert(res.msg); return; }
    onClose();
  };

  return createPortal(
    <div className="lb-ctx-backdrop" onClick={onClose}>
      <div className="lb-ctx" role="menu" aria-label={`${card.archetype} options`} onClick={(e) => e.stopPropagation()}>
        {view === 'develop' ? (
          <>
            <div className="lb-ctx-note">{team.coach?.archetype} coaches develop {stats.join(' or ')}.</div>
            {stats.map((stat) => <button type="button" role="menuitem" className="develop" key={stat} disabled={!points} onClick={() => develop(stat)}>+1 {stat}</button>)}
            <button type="button" className="ghost" onClick={() => setView('main')}>Back</button>
          </>
        ) : (
          <>
            {onSelect && <button type="button" role="menuitem" className="primary" onClick={() => { onClose(); onSelect(card); }}>{selectLabel}</button>}
            {!readOnly && <button type="button" role="menuitem" className="develop" disabled={!canEdit || !points} onClick={() => setView('develop')}>Develop<small>{canEdit ? pointsText : 'Locked'}</small></button>}
            {!readOnly && <button type="button" role="menuitem" className="release" disabled={!canEdit} onClick={release}>Release{!canEdit && <small>Locked</small>}</button>}
            <button type="button" role="menuitem" onClick={() => { onClose(); onLearn(card); }}>Learn More</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
