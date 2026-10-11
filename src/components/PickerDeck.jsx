import { memo, useEffect, useRef, useState } from 'react';
import { CardRevealPlayer } from './CardReveal';

// The lineup picker's fanned deck: the current card on top, the next few fanned out behind it.
// Swipe left for the next card (this one is sent away to the left); swipe right and the previous
// card is drawn back in from the left while this one settles back into the stack. No wrap-around.
// Drag state lives here, so moving a finger only re-renders the deck — not the whole lineup page —
// and the card faces themselves are memoized, so only the wrapper transforms change per frame.
const DEPTH = 3;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fanAt = (d) => `translateX(${d * 16}px) translateY(${-d * 8}px) rotate(${d * 3.5}deg) scale(${1 - d * 0.055})`;

const DeckFace = memo(function DeckFace({ card, up, h, label, finale }) {
  return <CardRevealPlayer card={card} up={up} cardHeight={h} rosterLabel={label} finale={finale} settled={!finale} delay={finale ? 420 : 0} />;
});

export default function PickerDeck({ roster, index, onIndex, fit, labelFor, onOpen, containerRef, live }) {
  const [drag, setDrag] = useState({ dx: 0, active: false });
  const [pressId, setPressId] = useState(null);
  const start = useRef(0);
  const lastDx = useRef(0);
  const moved = useRef(false);
  const raf = useRef(0);
  const nRef = useRef(roster.length);
  const indexRef = useRef(index);
  nRef.current = roster.length;
  indexRef.current = index;

  useEffect(() => {
    if (!drag.active) return undefined;
    const move = (e) => {
      const dx = e.clientX - start.current;
      lastDx.current = dx;
      if (Math.abs(dx) > 6) moved.current = true;
      // At most one update per frame, however fast the pointer reports.
      if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setDrag({ dx: lastDx.current, active: true }); });
    };
    const finish = (commit) => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      const dx = lastDx.current;
      setDrag({ dx: 0, active: false });
      setPressId(null);
      if (!commit) return;
      if (dx < -70 && indexRef.current < nRef.current - 1) onIndex(indexRef.current + 1);
      else if (dx > 70 && indexRef.current > 0) onIndex(indexRef.current - 1);
    };
    const up = finish(true), cancel = finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); cancelAnimationFrame(raf.current); raf.current = 0; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag.active]);

  const n = roster.length;
  const w = 264 * fit.s, h = fit.h * fit.s + 44;
  const rawDx = drag.dx;
  // While dragging, the neighbouring cards follow the finger too.
  const pRight = drag.active && rawDx > 0 && index > 0 ? clamp01(rawDx / 220) : 0;
  const pLeft = drag.active && rawDx < 0 && index < n - 1 ? clamp01(-rawDx / 220) : 0;
  // Pulling past either end of the deck resists instead of moving freely.
  const dx = (index === 0 && rawDx > 0) || (index === n - 1 && rawDx < 0) ? rawDx / 4 : rawDx;

  return (
    <div
      className="lb-deck"
      ref={containerRef}
      onPointerDown={(e) => {
        if (e.target.closest('button, select, a')) return;
        start.current = e.clientX;
        lastDx.current = 0;
        moved.current = false;
        setPressId(roster[index]?.id ?? null);
        setDrag({ dx: 0, active: true });
      }}
    >
      {roster.map((card, idx) => {
        const k = idx - index; // < 0: already swiped past (gone to the left)
        const top = k === 0;
        const gone = k < 0;
        const kEff = Math.min(Math.max(k, 0) + pRight - pLeft, DEPTH + 1);
        let transform, opacity;
        if (top) {
          transform = pRight > 0 ? fanAt(pRight) : `translateX(${dx}px) rotate(${dx / 22}deg) scale(${pressId === card.id ? 0.955 : 1})`;
          opacity = 1;
        } else if (gone) {
          const back = k === -1 ? pRight : 0; // the previous card, being drawn back in
          transform = `translateX(${-460 * (1 - back)}px) translateY(${-30 * (1 - back)}px) rotate(${-16 * (1 - back)}deg)`;
          opacity = back;
        } else {
          transform = fanAt(kEff);
          opacity = kEff > DEPTH ? Math.max(0, DEPTH + 1 - kEff) : 1;
        }
        const shade = Math.min(0.6, (top ? pRight : kEff) * 0.17);
        return (
          <div
            key={card.id}
            className={'lb-deck-card' + (top ? ' top' : '')}
            style={{
              width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform, opacity,
              zIndex: gone ? n + 2 + idx : n - k,
              transition: !live || drag.active ? 'none' : gone ? 'transform 420ms cubic-bezier(.16,.9,.24,1), opacity 260ms ease 220ms' : 'transform 380ms cubic-bezier(.16,.9,.24,1), opacity 260ms ease',
            }}
            aria-hidden={top ? undefined : true}
            role={top ? 'button' : undefined}
            tabIndex={top ? 0 : undefined}
            aria-label={top ? `${card.archetype} ${card.position}. Open card options.` : undefined}
            onClick={top ? () => { if (!moved.current) onOpen(card); } : undefined}
            onKeyDown={top ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(card); } } : undefined}
          >
            {/* The top card plays only the finish of the reveal — the frame striking on and, for a
                Legendary, the sheen — once it has moved into place; every other card is just the card. */}
            {top
              ? <DeckFace key={'top' + card.id} card={card} up={fit.s} h={fit.h} label={labelFor(card)} finale />
              : k >= -1 && k <= DEPTH + 1 && <DeckFace key={'rest' + card.id} card={card} up={fit.s} h={fit.h} label={labelFor(card)} />}
            {(!top || pRight > 0) && shade > 0 && <div className="lb-deck-shade" style={{ opacity: shade }} />}
          </div>
        );
      })}
    </div>
  );
}
