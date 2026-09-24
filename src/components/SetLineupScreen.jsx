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

// team.activeIds has no slot concept at all — it's just an unordered array, and
// promoteToStarter always appends to its end regardless of which visual court slot was
// clicked. This reconciles a purely local, 5-entry "which id sits in which slot" array
// against the real activeIds: ids that are still active keep their existing slot, ids no
// longer active are cleared, and newly-active ids fill whatever slots are still open. Without
// this, a card placed into slot 3 could visually land in slot 0 instead, wherever
// activeIds.length happened to point.
function reconcileSlots(prevSlots, ids) {
  const next = prevSlots.map((id) => (id != null && ids.includes(id) ? id : null));
  for (const id of ids) {
    if (next.includes(id)) continue;
    const openIndex = next.indexOf(null);
    if (openIndex >= 0) next[openIndex] = id;
  }
  while (next.length < 5) next.push(null);
  return next.slice(0, 5);
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

function MiniCard({ card, selected, onClick, onRemove, dim }) {
  if (!card) {
    return <button type="button" className="slf-card slf-card-empty" onClick={onClick} disabled={!onClick}><span>+</span></button>;
  }
  const skillset = skillsetFor(card);
  return (
    <div className="slf-card-wrap">
      <button type="button" className={'slf-card' + (selected ? ' selected' : '') + (dim ? ' dim' : '')} onClick={onClick} disabled={!onClick}>
        <span className="slf-card-top"><span className="slf-card-pos">{card.position}</span><span className="slf-card-grade">{playerGrade(card)}</span></span>
        <span className="slf-card-num">#{jerseyNumber(card)}</span>
        <span className="slf-card-name">{card.archetype}</span>
        <span className="slf-card-skill">{skillset?.name || 'No Skillset'}</span>
      </button>
      {onRemove && <button type="button" className="slf-card-remove" onClick={onRemove} aria-label={`Remove ${card.archetype} from the lineup`}>-</button>}
    </div>
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
  const [slotOrder, setSlotOrder] = useState([null, null, null, null, null]);
  // Reconcile whenever the actual SET of starters changes (order-independent key) — covers
  // both this component's own actions and any external change (e.g. clearLineup on mount).
  const activeIdsSetKey = activeIds.slice().sort().join(',');
  useEffect(() => {
    setSlotOrder((prev) => reconcileSlots(prev, activeIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsSetKey]);
  const starters = slotOrder.map((id) => (id ? team.hand.find((c) => c.id === id) || null : null));
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

  // Click to hold a card (bench or court), click again to release it, click a different card
  // in the same group to switch which one is held. A held card is placed by clicking the
  // OTHER group next — a bench card onto a court slot (empty or occupied), or a starter onto
  // a bench card. Nothing happens instantly on a single click; placing always takes two.
  const holdCard = (cardId) => {
    if (!canEdit) return;
    setSelectedId((cur) => (cur === cardId ? null : cardId));
  };

  // A five-only swapStarter can't place someone while a slot is genuinely empty (still being
  // built up from nothing) — fall back to demote-then-promote, the same two calls
  // swapStarter itself would otherwise make atomically. Returns whether it actually succeeded,
  // so the caller only commits the visual slot change (see reconcileSlots above) once the real
  // game state agrees.
  const placeIncoming = (incomingId, occupant) => {
    if (!occupant) {
      const res = actions.promoteToStarter(myTeamId, incomingId);
      if (res && res.ok === false) { alert(res.msg); return false; }
      return true;
    }
    if (activeIds.length === 5) {
      const res = actions.swapStarter(myTeamId, occupant.id, incomingId);
      if (res && res.ok === false) { alert(res.msg); return false; }
      return true;
    }
    actions.demoteStarter(myTeamId, occupant.id);
    actions.promoteToStarter(myTeamId, incomingId);
    return true;
  };

  const placeOnSlot = (slotIndex) => {
    if (!canEdit || selectedId == null || activeIds.includes(selectedId)) { setSelectedId(null); return; }
    const incomingId = selectedId;
    const occupant = starters[slotIndex];
    setSelectedId(null);
    if (placeIncoming(incomingId, occupant)) {
      setSlotOrder((prev) => { const next = [...prev]; next[slotIndex] = incomingId; return next; });
    }
  };

  const handleBenchClick = (card) => {
    if (!canEdit) return;
    if (selectedId != null && activeIds.includes(selectedId)) {
      const outgoingId = selectedId;
      const outgoingIndex = slotOrder.indexOf(outgoingId);
      const outgoing = starters[outgoingIndex];
      setSelectedId(null);
      if (placeIncoming(card.id, outgoing) && outgoingIndex >= 0) {
        setSlotOrder((prev) => { const next = [...prev]; next[outgoingIndex] = card.id; return next; });
      }
      return;
    }
    holdCard(card.id);
  };

  const handleRemove = (card) => {
    if (!canEdit) return;
    setSelectedId(null);
    const res = actions.demoteStarter(myTeamId, card.id);
    if (res && res.ok === false) { alert(res.msg); return; }
    const idx = slotOrder.indexOf(card.id);
    if (idx >= 0) setSlotOrder((prev) => { const next = [...prev]; next[idx] = null; return next; });
  };

  const handleSave = () => {
    const res = actions.markLineupSet(myTeamId);
    if (res && res.valid === false) alert(res.msg);
    else onClose();
  };

  // A valid five, never the strongest one (see roster.js's autoValidFive) — an escape hatch
  // for someone who doesn't want to hand-pick, not a "set my best lineup" shortcut.
  const handleAutoSet = () => {
    setSelectedId(null);
    const res = actions.autoSetLineup(myTeamId);
    if (res && res.ok === false) alert(res.msg);
  };

  return (
    <div className="tsx-overlay" role="dialog" aria-modal="true" aria-label="Your Lineup">
      <div className="slf-panel">
        <div className="slf-head">
          <h2 className="slf-title">Your Lineup</h2>
          <div className="slf-synergy-totals">
            <span className="off">Offense +{synergy.skillOffense}</span>
            <span className="def">Defense +{synergy.skillDefense}</span>
          </div>
        </div>

        <p className="slf-note">{canEdit ? 'Set your lineup. Lines between players show how pairings affect your team’s offense and/or defense.' : 'Your lineup. Lines between players show how pairings affect your team’s offense and/or defense.'}</p>

        {canEdit && (
          <div className="slf-quick-actions">
            <button type="button" className="secondary" onClick={handleAutoSet}>Auto Set Lineup</button>
          </div>
        )}

        {wires.length > 0 && (
          <div className="slf-pairings">
            <div className="slf-microlabel">Active Pairings</div>
            {wires.map((w, i) => (
              <div key={w.id} className="slf-pairing-row">
                <span className={'slf-pairing-num ' + w.pair.side}>{i + 1}</span>
                <span className="slf-pairing-name">{w.pair.name}</span>
                <span className={'slf-pairing-value ' + w.pair.side}>+{w.pair.percent}% {w.pair.side === 'offense' ? 'OFF' : 'DEF'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="slf-columns">
          <div className="slf-court-col">
            <div className="slf-court" ref={courtRef}>
              <CourtLines />
              <svg className="slf-wire-svg">
                {wires.map((w) => <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={'slf-wire ' + w.pair.side} />)}
              </svg>
              {wires.map((w, i) => (
                <div key={w.id} className={'slf-wire-badge ' + w.pair.side} style={{ left: (w.x1 + w.x2) / 2, top: (w.y1 + w.y2) / 2 }} title={`${w.pair.name} +${w.pair.percent}% ${w.pair.side === 'offense' ? 'OFF' : 'DEF'}`}>
                  {i + 1}
                </div>
              ))}
              {COURT_SLOTS.map((pos, i) => (
                <div className="slf-slot" style={{ left: pos.left, top: pos.top }} key={i} ref={(el) => { slotRefs.current[i] = el; }}>
                  <MiniCard
                    card={starters[i]}
                    selected={starters[i] && selectedId === starters[i].id}
                    onClick={canEdit ? () => (starters[i] && selectedId == null ? holdCard(starters[i].id) : placeOnSlot(i)) : undefined}
                    onRemove={canEdit && starters[i] ? () => handleRemove(starters[i]) : undefined}
                  />
                </div>
              ))}
            </div>
            {team.coach && (
              <div className="slf-coach">
                <div className="slf-microlabel">Head Coach</div>
                <div className="slf-coach-name">{team.coach.archetype}</div>
              </div>
            )}
          </div>

          <div className="slf-sideline">
            <div className="slf-bench">
              <div className="slf-microlabel">Bench</div>
              <div className="slf-bench-row">
                {bench.map((c) => <MiniCard key={c.id} card={c} selected={selectedId === c.id} onClick={canEdit ? () => handleBenchClick(c) : undefined} dim />)}
                {bench.length === 0 && <span className="slf-bench-empty">No bench players.</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="slf-footer">
          {canEdit ? (
            <button type="button" className="primary" onClick={handleSave}>Save Lineup</button>
          ) : (
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
