import { useEffect } from 'react';
import { findSkillPair, skillsetFor } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';

// The Team Synergy cross table — every starter against every other starter, filled cells pay a
// passive Skillset-pair bonus, empty cells are pairs with no rule between them. Modal by design:
// it's a reference/inspection view of the current five, not a place to make changes, so it takes
// focus and has to be dismissed deliberately (no backdrop-click dismiss, Escape still works)
// rather than living inline where it would compete with the rest of the franchise page.
const findPair = findSkillPair;

function HeaderCell({ card }) {
  const skillset = skillsetFor(card);
  return (
    <div className="tsx-head-cell">
      <div className="tsx-head-top">
        <span className="tsx-head-jersey">#{jerseyNumber(card)}</span>
        <span className="tsx-head-meta">{card.position} · {playerGrade(card)}</span>
      </div>
      <div className="tsx-head-archetype">{card.archetype}</div>
      <div className="tsx-head-skillset">{skillset?.name || 'No Skillset'}</div>
    </div>
  );
}

export default function TeamSynergyModal({ team, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const activeIds = team.activeIds || [];
  const starters = activeIds.map((id) => (team.hand || []).find((c) => c.id === id)).filter(Boolean);
  const bench = (team.hand || []).filter((c) => !activeIds.includes(c.id));

  const cols = starters.slice(1);
  const rows = starters.slice(0, -1);

  const gridItems = [<div key="corner" className="tsx-corner" />];
  for (const col of cols) gridItems.push(<HeaderCell key={`col-${col.id}`} card={col} />);
  rows.forEach((row, ri) => {
    gridItems.push(<HeaderCell key={`row-${row.id}`} card={row} />);
    cols.forEach((col, ci) => {
      const cellKey = `${row.id}:${col.id}`;
      if (ci < ri) { gridItems.push(<div key={cellKey} className="tsx-cell-blank" />); return; }
      const pair = findPair(row, col);
      gridItems.push(
        <div key={cellKey} className={'tsx-cell' + (pair ? ' live ' + pair.side : ' inert')}>
          {pair ? (
            <>
              <span className="tsx-cell-live">Live</span>
              <span className="tsx-cell-name">{pair.name}</span>
              <span className="tsx-cell-value">+{pair.percent}% {pair.side === 'offense' ? 'OFF' : 'DEF'}</span>
            </>
          ) : <span className="tsx-cell-dot">·</span>}
        </div>
      );
    });
  });

  // A bench player whose skillset would pair with a current starter's — swapping them in would
  // light this pairing up. Only reachable pairings (the bench half is the missing half) show.
  const dormant = [];
  for (const b of bench) {
    for (const s of starters) {
      const pair = findPair(b, s);
      if (pair) dormant.push({ bench: b, starter: s, pair });
    }
  }

  return (
    <div className="tsx-overlay" role="dialog" aria-modal="true" aria-label="Synergy">
      <div className="tsx-panel">
        <div className="tsx-panel-head">
          <div>
            <div className="tsx-eyebrow">Synergy</div>
            <h2 className="tsx-title">{team.name}</h2>
          </div>
          <button className="tsx-close" onClick={onClose} aria-label="Close Synergy">Close ×</button>
        </div>

        {starters.length < 2 ? (
          <p className="tsx-note">Set a starting five to see pairings.</p>
        ) : (
          <div className="tsx-table-wrap">
            <p className="tsx-note">Every starter against every other starter. Filled cells pay a passive bonus; empty cells are pairs with no rule between those two Skillsets.</p>
            <div className="tsx-grid" style={{ gridTemplateColumns: `140px repeat(${cols.length}, minmax(120px, 1fr))` }}>
              {gridItems}
            </div>
          </div>
        )}

        {dormant.length > 0 && (
          <div className="tsx-dormant-list">
            <div className="tsx-dormant-head">Dormant — on the bench</div>
            {dormant.map(({ bench: b, starter: s, pair }, i) => (
              <div key={i} className="tsx-dormant-row">
                <span>#{jerseyNumber(b)} {b.archetype} ({skillsetFor(b)?.name}) would pair with #{jerseyNumber(s)} {s.archetype}</span>
                <span className={'tsx-dormant-value ' + pair.side}>{pair.name} +{pair.percent}% {pair.side === 'offense' ? 'OFF' : 'DEF'} if started</span>
              </div>
            ))}
          </div>
        )}

        <div className="tsx-legend">
          <span><i className="tsx-swatch offense" />Offensive pairing</span>
          <span><i className="tsx-swatch defense" />Defensive pairing</span>
          <span className="tsx-legend-dot">· No rule between that pair of Skillsets</span>
        </div>
      </div>
    </div>
  );
}
