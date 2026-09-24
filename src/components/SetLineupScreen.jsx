import { useEffect, useRef, useState } from 'react';
import { SKILLSET_PAIRS, skillsetFor, teamSynergy } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';

// "The Floor" (design ref 1a) — the starting five placed on a half-court diagram, wired
// together wherever two of them share a live Skillset pairing (game/skillsets.js's
// SKILLSET_PAIRS — the same bonus TeamSynergyModal's cross-table shows, just drawn here
// instead of tabulated). The five court positions below are a fixed, purely cosmetic layout
// (this game only tracks Guard/Forward/Big, not five true positions) so a starter can occupy
// any of the five spots — nothing here enforces which slot a given position "belongs" in
// beyond what confirmLineup already requires (one of each Guard/Forward/Big among the five).
const COURT_SLOTS = [
  { left: '50%', top: '16%' },
  { left: '14%', top: '46%' },
  { left: '86%', top: '46%' },
  { left: '30%', top: '80%' },
  { left: '70%', top: '80%' },
];

function findPair(a, b) {
  if (!a?.skillsetId || !b?.skillsetId) return null;
  return SKILLSET_PAIRS.find((p) => p.skills.includes(a.skillsetId) && p.skills.includes(b.skillsetId)) || null;
}

// A plain half-court diagram — baseline, key, free-throw circle, a corner-to-corner three
// point arc, and the center line/circle at the far edge — decorative flavor rather than a
// regulation-accurate court, drawn once at a fixed viewBox that matches .slf-court's own
// 3:4 aspect-ratio so it always fills the box without distortion.
function CourtLines() {
  return (
    <svg className="slf-court-lines" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="10" y="10" width="280" height="380" />
      <rect x="95" y="10" width="110" height="160" />
      <circle cx="150" cy="170" r="42" />
      <circle cx="150" cy="32" r="6" />
      <line x1="130" y1="24" x2="170" y2="24" />
      <path d="M 35 92 A 205 205 0 0 0 265 92" />
      <line x1="35" y1="10" x2="35" y2="92" />
      <line x1="265" y1="10" x2="265" y2="92" />
      <path d="M 110 390 A 40 40 0 0 1 190 390" />
    </svg>
  );
}

function MiniCard({ card, selected, onClick, dim }) {
  if (!card) {
    return <button type="button" className="slf-card slf-card-empty" onClick={onClick} disabled={!onClick}><span>+</span></button>;
  }
  const skillset = skillsetFor(card);
  return (
    <button type="button" className={'slf-card' + (selected ? ' selected' : '') + (dim ? ' dim' : '')} onClick={onClick} disabled={!onClick}>
      <span className="slf-card-top"><span className="slf-card-pos">{card.position}</span><span className="slf-card-grade">{playerGrade(card)}</span></span>
      <span className="slf-card-num">#{jerseyNumber(card)}</span>
      <span className="slf-card-name">{card.archetype}</span>
      <span className="slf-card-skill">{skillset?.name || 'No Skillset'}</span>
    </button>
  );
}

export default function SetLineupScreen({ team, actions, myTeamId, canEdit, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  // Nine empty-looking slots to start — the auto-selected five is a placeholder nobody has
  // actually chosen, so a human's first visit each season clears it and starts from scratch.
  // Only runs once per mount, and only pre-season (canEdit) — a locked-in, already-reviewed
  // lineup (lineupSet true) is left exactly as it is.
  useEffect(() => {
    if (canEdit && !team.lineupSet && (team.activeIds || []).length > 0) {
      actions.clearLineup(myTeamId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIds = team.activeIds || [];
  const starters = activeIds.map((id) => team.hand.find((c) => c.id === id) || null);
  while (starters.length < 5) starters.push(null);
  const bench = team.hand.filter((c) => !activeIds.includes(c.id));
  const [selectedId, setSelectedId] = useState(null);

  const courtRef = useRef(null);
  const slotRefs = useRef([]);
  const [wires, setWires] = useState([]);
  const starterKey = starters.map((c) => c?.id ?? 'x').join(',');
  useEffect(() => {
    const courtEl = courtRef.current;
    if (!courtEl) return undefined;
    const compute = () => {
      const courtRect = courtEl.getBoundingClientRect();
      const centers = slotRefs.current.map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - courtRect.left, y: r.top + r.height / 2 - courtRect.top };
      });
      const next = [];
      for (let i = 0; i < starters.length; i++) {
        for (let j = i + 1; j < starters.length; j++) {
          const pair = findPair(starters[i], starters[j]);
          if (!pair || !centers[i] || !centers[j]) continue;
          next.push({ id: i + '-' + j, x1: centers[i].x, y1: centers[i].y, x2: centers[j].x, y2: centers[j].y, pair });
        }
      }
      setWires(next);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(courtEl);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterKey]);

  const synergy = teamSynergy(team);

  // Same select-then-place model as the Rotation tab: hold a card by tapping it, then tap
  // either a court starter or a bench card to trade places with it. While the five is still
  // being built up from empty, a bare tap on any bench card just fills the next open slot
  // (promoteToStarter already handles activeIds under 5 one at a time) — so simply tapping
  // hand cards in order is enough to build the five without a separate "pick a slot" step.
  const handlePick = (card) => {
    if (!canEdit) return;
    const isStarter = activeIds.includes(card.id);
    if (activeIds.length < 5 && !isStarter) {
      setSelectedId(null);
      const res = actions.promoteToStarter(myTeamId, card.id);
      if (res && res.ok === false) alert(res.msg);
      return;
    }
    if (selectedId == null) { setSelectedId(card.id); return; }
    if (selectedId === card.id) { setSelectedId(null); return; }
    const selectedIsStarter = activeIds.includes(selectedId);
    if (selectedIsStarter === isStarter) { setSelectedId(card.id); return; }
    const outgoingId = selectedIsStarter ? selectedId : card.id;
    const incomingId = selectedIsStarter ? card.id : selectedId;
    setSelectedId(null);
    const res = actions.swapStarter(myTeamId, outgoingId, incomingId);
    if (res && res.ok === false) alert(res.msg);
  };

  const handleSave = () => {
    const res = actions.markLineupSet(myTeamId);
    if (res && res.valid === false) alert(res.msg);
    else onClose();
  };

  return (
    <div className="tsx-overlay" role="dialog" aria-modal="true" aria-label="Set The Rotation">
      <div className="slf-panel">
        <div className="slf-head">
          <div>
            <div className="slf-eyebrow">Set The Rotation</div>
            <h2 className="slf-title">The Floor</h2>
          </div>
          <div className="slf-synergy-totals">
            <span className="off">OFF +{synergy.skillOffense}</span>
            <span className="def">DEF +{synergy.skillDefense}</span>
          </div>
        </div>

        <p className="slf-note">{canEdit ? 'Set your lineup. Lines between players show how pairings affect your team’s offense and/or defense.' : 'Your lineup. Lines between players show how pairings affect your team’s offense and/or defense.'}</p>

        <div className="slf-columns">
          <div className="slf-court" ref={courtRef}>
            <CourtLines />
            <svg className="slf-wire-svg">
              {wires.map((w) => <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={'slf-wire ' + w.pair.side} />)}
            </svg>
            {wires.map((w) => (
              <div key={w.id} className={'slf-wire-badge ' + w.pair.side} style={{ left: (w.x1 + w.x2) / 2, top: (w.y1 + w.y2) / 2 }}>
                {w.pair.name} +{w.pair.percent}% {w.pair.side === 'offense' ? 'OFF' : 'DEF'}
              </div>
            ))}
            {COURT_SLOTS.map((pos, i) => (
              <div className="slf-slot" style={{ left: pos.left, top: pos.top }} key={i} ref={(el) => { slotRefs.current[i] = el; }}>
                <MiniCard card={starters[i]} selected={starters[i] && selectedId === starters[i].id} onClick={canEdit && starters[i] ? () => handlePick(starters[i]) : undefined} />
              </div>
            ))}
          </div>

          <div className="slf-sideline">
            <div className="slf-bench">
              <div className="slf-microlabel">Bench</div>
              <div className="slf-bench-row">
                {bench.map((c) => <MiniCard key={c.id} card={c} selected={selectedId === c.id} onClick={canEdit ? () => handlePick(c) : undefined} dim />)}
                {bench.length === 0 && <span className="slf-bench-empty">No bench players.</span>}
              </div>
            </div>
            {team.coach && (
              <div className="slf-coach">
                <div className="slf-microlabel">Head Coach</div>
                <div className="slf-coach-name">{team.coach.archetype}</div>
              </div>
            )}
          </div>
        </div>

        <div className="slf-footer">
          {canEdit
            ? <button type="button" className="primary" onClick={handleSave}>Save Lineup</button>
            : <button type="button" className="secondary" onClick={onClose}>Close</button>}
        </div>
      </div>
    </div>
  );
}
