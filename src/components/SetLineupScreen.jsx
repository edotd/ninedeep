import { useEffect, useRef, useState } from 'react';
import { findSkillPair, skillsetFor } from '../game/skillsets';
import { jerseyNumber, playerGrade } from '../game/cards';
import { autoValidFive, validateLineup } from '../game/roster';
import { useIsDesktop } from '../hooks/useIsDesktop';
import PlayerCard from './PlayerCard';
import FrontOfficeCard from './FrontOfficeCard';

// Shown once per browser — the first time anyone opens this editor, not once per team/era, so
// re-explaining after a fresh solo game or a new room would be redundant.
const LINEUP_INTRO_KEY = 'nine-deep-lineup-intro-seen';

// "The Floor" (design ref 1a) — the starting five placed on a half-court diagram, wired
// together wherever two of them share a live Skillset pairing (game/skillsets.js's
// SKILLSET_PAIRS — the same bonus the Lineup & Chemistry tab's pairs list shows, just drawn here
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

function MiniCard({ card, selected, onClick, onRemove, dim, onHoverStart, onHoverEnd }) {
  if (!card) {
    return <button type="button" className="slf-card slf-card-empty" onClick={onClick} disabled={!onClick}><span>+</span></button>;
  }
  const skillset = skillsetFor(card);
  return (
    <div className="slf-card-wrap">
      <button
        type="button"
        className={'slf-card' + (selected ? ' selected' : '') + (dim ? ' dim' : '')}
        onClick={onClick}
        disabled={!onClick}
        onMouseEnter={() => onHoverStart?.(card.id)}
        onMouseLeave={() => onHoverEnd?.(card.id)}
      >
        <span className="slf-card-top"><span className="slf-card-pos">{card.position}</span><span className="slf-card-grade">{playerGrade(card)}</span></span>
        <span className="slf-card-num">#{jerseyNumber(card)}</span>
        <span className="slf-card-name">{card.archetype}</span>
        <span className="slf-card-skill">{skillset?.name || 'No Skillset'}</span>
      </button>
      {onRemove && <button type="button" className="slf-card-remove" onClick={onRemove} aria-label={`Remove ${card.archetype} from the lineup`}>-</button>}
    </div>
  );
}

export default function SetLineupScreen({ team, actions, myTeamId, canEdit, onClose, onPreviewChange }) {
  const isDesktop = useIsDesktop();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  // A one-time explainer, the first time anyone on this browser opens this editor — not
  // gated per-team/era, so a new solo game or room never re-shows it.
  const [showIntro, setShowIntro] = useState(() => {
    try { return localStorage.getItem(LINEUP_INTRO_KEY) !== '1'; } catch { return false; }
  });
  const dismissIntro = () => {
    setShowIntro(false);
    try { localStorage.setItem(LINEUP_INTRO_KEY, '1'); } catch { /* storage can be unavailable */ }
  };

  // Everything in this editor is a local draft. The shared team — and therefore the
  // Franchise page underneath this modal — is changed exactly once, by Save Lineup. A fresh
  // season still opens empty because the generated active five is only a placeholder until a
  // human reviews it; an already-saved lineup opens with its current five intact.
  const [slotOrder, setSlotOrder] = useState(() => reconcileSlots(
    [null, null, null, null, null],
    team.lineupSet ? (team.activeIds || []) : [],
  ));
  const activeIds = slotOrder.filter((id) => id != null);
  const starters = slotOrder.map((id) => (id ? team.hand.find((c) => c.id === id) || null : null));
  const bench = team.hand.filter((c) => !activeIds.includes(c.id));
  const [selectedId, setSelectedId] = useState(null);

  const previewSignature = starters.map((card) => card?.id ?? 'open').join(',');
  useEffect(() => {
    const stats = starters.reduce((totals, card) => {
      if (!card) return totals;
      for (const stat of ['SCO', 'PLM', 'REB', 'DEF']) totals[stat] += card.stats?.[stat] || 0;
      return totals;
    }, { SCO: 0, PLM: 0, REB: 0, DEF: 0 });
    onPreviewChange?.({ teamId: team.id, stats });
    // The player ids are the source of every stat total; card objects themselves remain stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSignature, team.id, onPreviewChange]);
  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);

  // A card is "held" the moment it's selected for placement (the existing tap-to-hold
  // mechanic, which is also mobile's only way to hold a card) or, on desktop only, moused
  // over — either way, show the full player card so its stats are readable without leaving
  // this screen. Non-interactive: it never intercepts the click that actually places a card.
  const [hoveredId, setHoveredId] = useState(null);
  const handleHoverStart = (cardId) => setHoveredId(cardId);
  const handleHoverEnd = (cardId) => setHoveredId((cur) => (cur === cardId ? null : cur));
  // Mobile has no real hover — some touch browsers still fire a synthetic mouseenter on first
  // tap, which would otherwise pop the preview on a plain tap rather than an actual hold. Only
  // trust hover on desktop; mobile shows the preview solely for a genuinely held (selected) card.
  const previewId = isDesktop ? (hoveredId ?? selectedId) : selectedId;
  const previewCard = previewId != null ? team.hand.find((c) => c.id === previewId) || null : null;

  // Mobile has no bench sidebar to hold a card from first (see the Players section, desktop
  // only below), so tapping an empty court slot there opens a picker of eligible players right
  // in this window instead — one tap to open, one tap on a card to place it. Desktop keeps its
  // existing hold-from-the-sidebar-then-tap-the-slot flow, so this is mobile-only.
  const [pickerSlotIndex, setPickerSlotIndex] = useState(null);
  useEffect(() => { if (isDesktop) setPickerSlotIndex(null); }, [isDesktop]);
  const placeCardInSlot = (slotIndex, cardId) => {
    setSelectedId(null);
    setSlotOrder((prev) => { const next = [...prev]; next[slotIndex] = cardId; return next; });
    setPickerSlotIndex(null);
  };

  // A starter's full card, or the coach's full card, centered on screen — a plain inspection
  // view, so it's available whether or not the lineup can be edited right now. { type: 'player',
  // card } or { type: 'coach' } (the coach itself always comes from `team`, already in scope).
  const [centeredCard, setCenteredCard] = useState(null);

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
      // A named pairing pays out once no matter how many starter pairs satisfy it (see
      // teamSynergy in game/skillsets.js — it dedupes by rule, not by player pair), so only the
      // first starter pair found for a given rule gets a wire. Without this, three starters
      // sharing one half of a pairing would draw — and list, and sum — that same bonus two or
      // three times over, well past what the team's actual Offense/Defense total reflects.
      const seenRules = new Set();
      const next = [];
      for (let i = 0; i < starters.length; i++) {
        for (let j = i + 1; j < starters.length; j++) {
          const pair = findSkillPair(starters[i], starters[j]);
          if (!pair || !centers[i] || !centers[j] || seenRules.has(pair.name)) continue;
          seenRules.add(pair.name);
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

  // Click a bench card to hold it, click again to release it, click a different bench card to
  // switch which one is held — a starter no longer becomes "held" by clicking it (that now
  // always shows its full card instead, see the court slots below), so a held card is always
  // a bench card, and it's always placed by clicking the target starter slot next.
  const holdCard = (cardId) => {
    if (!canEdit) return;
    setSelectedId((cur) => (cur === cardId ? null : cardId));
  };

  const placeOnSlot = (slotIndex) => {
    if (!canEdit || selectedId == null || activeIds.includes(selectedId)) { setSelectedId(null); return; }
    const incomingId = selectedId;
    setSelectedId(null);
    setSlotOrder((prev) => { const next = [...prev]; next[slotIndex] = incomingId; return next; });
  };

  const handleBenchClick = (card) => {
    if (!canEdit) return;
    holdCard(card.id);
  };

  const handleRemove = (card) => {
    if (!canEdit) return;
    setSelectedId(null);
    const idx = slotOrder.indexOf(card.id);
    if (idx >= 0) setSlotOrder((prev) => { const next = [...prev]; next[idx] = null; return next; });
  };

  const handleSave = () => {
    const ids = slotOrder.filter((id) => id != null);
    const check = validateLineup({ ...team, activeIds: ids });
    if (!check.valid) { alert(check.msg); return; }
    // Close in the same event as the single shared write. React batches these updates, so the
    // saved lineup first appears on the Franchise page only after the editor is gone.
    onClose();
    actions.saveLineup(myTeamId, ids);
  };

  // A valid five, never the strongest one (see roster.js's autoValidFive) — an escape hatch
  // for someone who doesn't want to hand-pick, not a "set my best lineup" shortcut.
  const handleAutoSet = () => {
    setSelectedId(null);
    setSlotOrder(reconcileSlots([null, null, null, null, null], autoValidFive(team.hand)));
  };

  return (
    <div className="tsx-overlay" role="dialog" aria-modal="true" aria-label="Your Lineup">
      <div className="slf-panel">
        <p className="slf-note">{canEdit ? 'Set your lineup. Lines between players show how pairings affect your team’s offense and/or defense.' : 'Your lineup. Lines between players show how pairings affect your team’s offense and/or defense.'}</p>

        {wires.length > 0 && (
          <div className="slf-pairings">
            <div className="slf-microlabel">Lineup Fit</div>
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
            <div className="slf-microlabel slf-starters-label">Starters</div>
            <div className="slf-court" ref={courtRef}>
              <CourtLines />
              {team.coach && (
                <button type="button" className="slf-coach" onClick={() => setCenteredCard({ type: 'coach' })}>
                  <div className="slf-microlabel">Head Coach</div>
                  <div className="slf-coach-name">{team.coach.archetype}</div>
                </button>
              )}
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
                    onClick={(starters[i] || canEdit) ? () => {
                      if (starters[i]) {
                        // A held bench card still completes its swap by clicking the target
                        // starter slot on desktop — everywhere else, clicking a starter is
                        // simply "show me this player's full card."
                        if (isDesktop && canEdit && selectedId != null && !activeIds.includes(selectedId)) {
                          placeOnSlot(i);
                        } else {
                          setCenteredCard({ type: 'player', card: starters[i] });
                        }
                      } else if (!isDesktop) {
                        setSelectedId(null);
                        setPickerSlotIndex(i);
                      } else {
                        placeOnSlot(i);
                      }
                    } : undefined}
                    onRemove={canEdit && starters[i] ? () => handleRemove(starters[i]) : undefined}
                    onHoverStart={handleHoverStart}
                    onHoverEnd={handleHoverEnd}
                  />
                </div>
              ))}
            </div>
          </div>

          {isDesktop && (
            <div className="slf-sideline">
              <div className="slf-bench">
                <div className="slf-microlabel">Players</div>
                <div className="slf-bench-row">
                  {starters.map((c, i) => (
                    <MiniCard
                      key={c ? c.id : 'starter-open-' + i}
                      card={c}
                      onClick={(c || canEdit) ? () => {
                        if (c) {
                          if (canEdit && selectedId != null) placeOnSlot(i);
                          else setCenteredCard({ type: 'player', card: c });
                        } else {
                          placeOnSlot(i);
                        }
                      } : undefined}
                      onRemove={canEdit && c ? () => handleRemove(c) : undefined}
                      onHoverStart={handleHoverStart}
                      onHoverEnd={handleHoverEnd}
                    />
                  ))}
                  {bench.map((c) => (
                    <MiniCard
                      key={c.id}
                      card={c}
                      selected={selectedId === c.id}
                      onClick={canEdit ? () => handleBenchClick(c) : undefined}
                      onHoverStart={handleHoverStart}
                      onHoverEnd={handleHoverEnd}
                      dim
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="slf-footer">
          {canEdit && (
            <div className="slf-footer-actions">
              <button type="button" className="slf-auto-set" onClick={handleAutoSet}><span aria-hidden="true">↻</span> Auto Set Lineup</button>
              <button type="button" className="slf-save-btn" onClick={handleSave}>Save Lineup</button>
            </div>
          )}
          <button type="button" className={canEdit ? 'secondary' : 'primary'} onClick={onClose}>Back</button>
        </div>
      </div>

      {previewCard && (
        <div className="slf-preview" aria-hidden="true">
          <PlayerCard card={previewCard} />
        </div>
      )}

      {pickerSlotIndex != null && (
        <div className="slf-slot-picker-backdrop" onClick={() => setPickerSlotIndex(null)}>
          <div className="slf-slot-picker" role="dialog" aria-modal="true" aria-label="Choose a starter" onClick={(e) => e.stopPropagation()}>
            <div className="slf-slot-picker-head">
              <span>Choose A Starter</span>
              <button type="button" className="slf-picker-close" onClick={() => setPickerSlotIndex(null)} aria-label="Close">×</button>
            </div>
            <div className="slf-slot-picker-carousel">
              {bench.map((c) => (
                <button key={c.id} type="button" className="slf-slot-picker-card" onClick={() => placeCardInSlot(pickerSlotIndex, c.id)}>
                  <PlayerCard card={c} />
                </button>
              ))}
              {bench.length === 0 && <div className="slf-slot-picker-empty">No available players.</div>}
            </div>
          </div>
        </div>
      )}

      {centeredCard && (
        <div className="slf-card-modal-backdrop" onClick={() => setCenteredCard(null)}>
          <div
            className="slf-card-modal"
            role="dialog"
            aria-modal="true"
            aria-label={centeredCard.type === 'coach' ? 'Coach card' : 'Player card'}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="slf-picker-close" onClick={() => setCenteredCard(null)} aria-label="Close">×</button>
            {centeredCard.type === 'coach' ? <FrontOfficeCard kind="coach" team={team} /> : <PlayerCard card={centeredCard.card} />}
          </div>
        </div>
      )}

      {showIntro && (
        <div className="slf-intro-backdrop" onClick={dismissIntro}>
          <div className="slf-intro" onClick={(e) => e.stopPropagation()}>
            <h3>Set Your Lineup</h3>
            <p>Pair specific skillsets for offensive/defensive bonuses. Hold a card to view the full player card.</p>
            <button type="button" className="primary" onClick={dismissIntro}>Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}
