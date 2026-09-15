import { useLayoutEffect, useRef, useState } from 'react';

// The hand-annotation system from the design brand handoff's "Pre-deal landing (3A)" —
// Caveat-labelled margin notes either side of a real production card, each connected to the
// feature it names by a curved leader line ending in a small dot, with a hand-drawn double
// loop circling the two or three most important figures. Unlike the design reference (which
// hardcodes pixel positions against one fixed example card), this measures the actual
// rendered card via getBoundingClientRect so it stays correct regardless of card content —
// a matchup card's statement text wraps to one line or three depending on the card dealt.
const NOTE_WIDTH = 224;
const NOTE_GAP = 10; // minimum vertical gap between stacked notes on the same side
const SIDE_PAD = NOTE_WIDTH + 34; // column width + gap to the card

const LOOP_ROTATIONS = [-3, 2, -6, 3, -2, 4];

function loopPaths(rect, rotate) {
  const pad = 6;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = rect.width / 2 + pad;
  const ry = rect.height / 2 + pad;
  const outer = `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * 1.28}, ${cx + rx} ${cy - ry * 1.28}, ${cx + rx} ${cy} C ${cx + rx} ${cy + ry * 1.3}, ${cx - rx * 0.92} ${cy + ry * 1.34}, ${cx - rx * 0.88} ${cy + ry * 0.12}`;
  const inner = `M ${cx - rx * 0.86} ${cy + ry * 0.18} C ${cx - rx * 0.3} ${cy - ry * 0.62}, ${cx + rx * 0.32} ${cy - ry * 1.02}, ${cx + rx * 0.82} ${cy - ry * 0.8}`;
  return { outer, inner, cx, cy, rotate };
}

function leaderPath(x1, y1, x2, y2) {
  const c1x = x1 + (x2 - x1) * 0.35;
  const c2x = x1 + (x2 - x1) * 0.75;
  return `M${x1},${y1} C${c1x},${y1} ${c2x},${y2} ${x2},${y2}`;
}

export default function CardAnnotation({ accent, notes, children }) {
  const stageRef = useRef(null);
  const cardSlotRef = useRef(null);
  const noteRefs = useRef({});
  const [geo, setGeo] = useState(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const cardSlot = cardSlotRef.current;
    if (!stage || !cardSlot) return undefined;

    function measure() {
      const stageRect = stage.getBoundingClientRect();
      const targets = {};
      notes.forEach((n) => {
        const el = cardSlot.querySelector(n.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        targets[n.key] = { left: r.left - stageRect.left, top: r.top - stageRect.top, width: r.width, height: r.height };
        if (n.circle) {
          const circleEl = n.circleSelector ? cardSlot.querySelector(n.circleSelector) : el;
          if (circleEl) {
            const cr = circleEl.getBoundingClientRect();
            targets[n.key + '__circle'] = { left: cr.left - stageRect.left, top: cr.top - stageRect.top, width: cr.width, height: cr.height };
          }
        }
      });

      const heights = {};
      notes.forEach((n) => {
        const el = noteRefs.current[n.key];
        if (el) heights[n.key] = el.getBoundingClientRect().height;
      });

      const bySide = { left: [], right: [] };
      notes.forEach((n) => {
        const t = targets[n.key];
        if (!t) return;
        bySide[n.side].push({ key: n.key, centerY: t.top + t.height / 2, height: heights[n.key] || 40 });
      });
      const tops = {};
      Object.keys(bySide).forEach((side) => {
        const arr = bySide[side].slice().sort((a, b) => a.centerY - b.centerY);
        let prevBottom = -Infinity;
        arr.forEach((item) => {
          let top = item.centerY - item.height / 2;
          if (top < prevBottom + NOTE_GAP) top = prevBottom + NOTE_GAP;
          tops[item.key] = top;
          prevBottom = top + item.height;
        });
      });

      const cardRect = cardSlot.getBoundingClientRect();
      let stageHeight = cardRect.bottom - stageRect.top;
      Object.keys(tops).forEach((k) => {
        stageHeight = Math.max(stageHeight, tops[k] + (heights[k] || 40));
      });

      setGeo({ targets, tops, stageWidth: stageRect.width, stageHeight: stageHeight + 6 });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cardSlot);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [notes]);

  const leftNotes = notes.filter((n) => n.side === 'left');
  const rightNotes = notes.filter((n) => n.side === 'right');

  return (
    <div className="co2-stage" ref={stageRef} style={{ padding: `0 ${SIDE_PAD}px`, minHeight: geo ? geo.stageHeight : undefined }}>
      <div className="co2-card-slot" ref={cardSlotRef}>{children}</div>

      {[...leftNotes, ...rightNotes].map((n, i) => (
        <div
          key={n.key}
          ref={(el) => { noteRefs.current[n.key] = el; }}
          className={'co2-note ' + n.side}
          style={{ top: geo ? geo.tops[n.key] : 0, visibility: geo ? 'visible' : 'hidden' }}
        >
          <div className="co2-note-label" style={{ color: accent }}>{n.label}</div>
          <div className="co2-note-text">{n.text}</div>
        </div>
      ))}

      {geo && (
        <svg className="co2-svg" width={geo.stageWidth} height={geo.stageHeight}>
          {notes.map((n) => {
            const t = geo.targets[n.key];
            const top = geo.tops[n.key];
            if (!t || top === undefined) return null;
            const dotX = t.left + t.width / 2;
            const dotY = t.top + t.height / 2;
            const startX = n.side === 'left' ? NOTE_WIDTH : geo.stageWidth - NOTE_WIDTH;
            const startY = top + 20;
            return <path key={n.key} d={leaderPath(startX, startY, dotX, dotY)} stroke={accent} strokeWidth="1.7" strokeLinecap="round" opacity="0.9" fill="none" />;
          })}
          {notes.map((n) => {
            const t = geo.targets[n.key];
            if (!t) return null;
            const dotX = t.left + t.width / 2;
            const dotY = t.top + t.height / 2;
            return <circle key={n.key + '-dot'} cx={dotX} cy={dotY} r="2.6" fill={accent} />;
          })}
          {notes.map((n, i) => {
            if (!n.circle) return null;
            const rect = geo.targets[n.key + '__circle'] || geo.targets[n.key];
            if (!rect) return null;
            const { outer, inner, cx, cy, rotate } = loopPaths(rect, LOOP_ROTATIONS[i % LOOP_ROTATIONS.length]);
            return (
              <g key={n.key + '-loop'} transform={`rotate(${rotate} ${cx} ${cy})`} stroke={accent} strokeLinecap="round" opacity="0.85" fill="none">
                <path d={outer} strokeWidth="1.7" />
                <path d={inner} strokeWidth="1.2" opacity="0.6" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
