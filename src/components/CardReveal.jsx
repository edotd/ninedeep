import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PlayerCard from './PlayerCard';
import FrontOfficeCard from './FrontOfficeCard';
import { PLAYER_NOTES, rarityLabelNote } from './playerCardNotes';
import RarityInfoPanel from './RarityInfoPanel';
import { COACH_NOTES, GM_NOTES } from './frontOfficeNotes';
import { ensureCoachSystems } from '../game/strategyCards';
import './CardReveal.css';

// The "Centre dot" card reveal (design: Card Reveal, variant 1B, Onboarding context) — the
// ball's nine dots light up one by one, the centre dot grows into the card, and the other eight
// fly out to the card's corners and edge midpoints and stamp the rarity frame in. The reveal
// escalates with rarity: Core is a quick open, Prime adds a fast light sweep, Signature lights
// each dot in stamp, Legendary adds a charge, a flash, two sheens and a resting glow. Every rarity
// gets its name stamped on a label at the card's top-right corner.
//
// Everything is laid out in the design's own 402×874 phone-screen coordinate space (the card's
// centre sits at 201,440) and the whole stage is scaled to fit the viewport, so the timings and
// offsets below are the design's numbers untouched. The face is the player's real card.

const INK = '#1E2B47', IRULE = '#3C4A69', FILE = '#E6DCC4',
  STAMP = '#B5431F', SINK = '#E8825C', FR = '#F0A03D';
const ARC = 'var(--font-label)';
const c01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
const P = (t, s, d) => c01((t - s) / d);
const eo = (p) => 1 - Math.pow(1 - p, 3);
const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const back = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

const RAR = {
  Core: { color: '#6B7894', w: 2, lit: '#6B7894' },
  Prime: { color: '#8E9BB5', w: 3, lit: '#8E9BB5' },
  Signature: { color: SINK, hair: FILE, w: 4, lit: STAMP },
  Legendary: { color: FR, hair: IRULE, w: 5, lit: FR },
};
const frameShadow = (r) => (RAR[r].hair ? `0 0 0 1px ${RAR[r].hair}, 0 0 0 ${1 + RAR[r].w}px ${RAR[r].color}` : `0 0 0 ${RAR[r].w}px ${RAR[r].color}`);
const STAGE_W = 402, STAGE_H = 874;
// Base width the real card is laid out at, and how far the reveal enlarges it. Front Office
// cards are landscape, so they take a wider base than the portrait player card.
const KINDS = {
  player: { cardW: 264, up: 1.3, label: 'Your franchise player' },
  coach: { cardW: 300, up: 1.2, label: 'Your coach' },
  gm: { cardW: 300, up: 1.2, label: 'Your general manager' },
};

// Once a card has landed it slowly settles down (and, for the tall player card, shrinks a touch)
// to make room for a short blurb that fades in above it.
const SETTLE = { player: { dy: 66, s: 0.92 }, coach: { dy: 64, s: 1 }, gm: { dy: 64, s: 1 } };
const SETTLE_MS = 1200;
const BLURBS = {
  player: { title: 'Players', text: 'The building blocks of your team. Each player\u2019s stats contribute to your team\u2019s output.' },
  coach: { title: 'The Coach', text: 'Drives your team\u2019s success with an overarching gameplan, stat bonuses and offensive and defensive die values.' },
  gm: { title: 'The GM', text: 'Determines your team\u2019s budget and ability to acquire new talent.' },
};

const BALL_T = {
  Core: { pop: 0, light: 99999, stag: 0, grow: 420, fly: 440, reveal: 720, strike: 1000, badge: 1080, ui: 1100, total: 1700 },
  Prime: { pop: 0, light: 300, stag: 25, grow: 620, fly: 650, reveal: 950, strike: 1250, badge: 1330, ui: 1380, total: 1950 },
  Signature: { pop: 0, light: 380, stag: 35, grow: 760, fly: 800, reveal: 1140, strike: 1480, badge: 1560, ui: 1670, total: 2120 },
  Legendary: { pop: 0, light: 560, stag: 70, hold: 1120, grow: 1560, fly: 1600, flash: 1560, reveal: 2000, strike: 2400, badge: 2520, sheen1: 2700, sheen2: 3080, ui: 3160, total: 3740 },
};

function Sheen({ t, tm, cw, ch }) {
  const pass = (s, d, w) => {
    const p = P(t, s, d);
    if (p <= 0 || p >= 1) return null;
    return (
      <div style={{ position: 'absolute', top: -ch, left: 0, width: w, height: ch * 3, transform: `translateX(${lerp(-w * 2, cw + w, eio(p))}px) rotate(20deg)`,
        background: 'linear-gradient(90deg, transparent, rgba(255,250,235,0.18) 35%, rgba(255,255,255,0.55) 50%, rgba(255,250,235,0.18) 65%, transparent)' }}
      />
    );
  };
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>{pass(tm.sheen1, 560, 120)}{pass(tm.sheen2, 460, 60)}</div>;
}

// `bare` drops the full-screen chrome (ink ground and Continue button) and centres the
// reveal in whatever box it's placed in — used by CardRevealPlayer below.
function Chrome({ t, tm, rarity, cw, ch, onContinue, ctaLabel, bare, shift, onBadge, children }) {
  const L = rarity === 'Legendary';
  const ui = eo(P(t, tm.ui, 500));
  const flash = tm.flash != null ? Math.max(0, 1 - P(t, tm.flash, 320)) * (t >= tm.flash ? 1 : 0) : 0;
  const glow = tm.flash != null && t >= tm.flash ? lerp(1, 0.45, eo(P(t, tm.flash, 900))) : 0;
  const bp = P(t, tm.badge, 260), bs = P(t, tm.badge + 260, 300);
  const badgeScale = bp > 0 ? (bs > 0 ? lerp(1.55, 1, back(bs)) : lerp(0.4, 1.55, eo(bp))) : 0;
  // Boxed in a slide, the glow is sized to fit it; full-screen it keeps the design's 640px.
  const glowD = bare ? Math.min(420, cw + 70) : 640;
  const bloom = bs > 0 ? 1 - eo(P(t, tm.badge + 260, 420)) : bp > 0 ? 1 : 0;
  return (
    <div style={bare ? { position: 'absolute', inset: 0 } : { position: 'absolute', inset: 0, background: INK, overflow: 'hidden' }}>
      {glow > 0 && <div style={{ position: 'absolute', ...(bare ? { left: `calc(50% - ${glowD / 2}px)`, top: `calc(50% - ${glowD / 2}px)`, width: glowD, height: glowD, pointerEvents: 'none' } : { left: 201 - 320, top: 440 - 320, width: 640, height: 640 }), borderRadius: '50%', opacity: glow, background: 'radial-gradient(closest-side, rgba(240,160,61,0.42), rgba(240,160,61,0.12) 55%, transparent)' }} />}
      <div style={{ position: 'absolute', left: bare ? '50%' : 201, top: bare ? '50%' : 440 + (shift?.dy || 0), width: 0, height: 0, transform: shift && shift.s !== 1 ? `scale(${shift.s})` : undefined, transformOrigin: '0 0' }}>
        {children}
        {badgeScale > 0 && (
          <div className="card-reveal-badge" onClick={onBadge} style={{ pointerEvents: onBadge ? 'auto' : undefined, cursor: onBadge ? 'pointer' : undefined, position: 'absolute', left: cw / 2 - 8, top: -ch / 2 - 13, transform: `translateX(-100%) scale(${badgeScale})`, transformOrigin: '100% 0',
            background: RAR[rarity].color, padding: '6px 9px', fontFamily: ARC, fontSize: 13, letterSpacing: '0.14em', color: rarity === 'Core' ? FILE : INK, whiteSpace: 'nowrap',
            boxShadow: L ? `0 0 ${26 * bloom}px ${6 * bloom}px rgba(240,160,61,${0.75 * bloom})` : 'none' }}
          >{rarity.toUpperCase()}</div>
        )}
      </div>
      {!bare && <div style={{ position: 'absolute', left: 24, right: 24, bottom: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, opacity: ui, transform: `translateY(${lerp(14, 0, ui)}px)` }}>
        <button
          type="button"
          onClick={onContinue}
          disabled={ui < 0.6}
          style={{ alignSelf: 'stretch', height: 54, border: 0, background: FILE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ARC, fontSize: 14, letterSpacing: '0.16em', color: INK, cursor: 'pointer' }}
        >{ctaLabel}</button>
      </div>}
      {flash > 0 && <div style={{ position: bare ? 'fixed' : 'absolute', inset: 0, background: FR, opacity: 0.38 * flash, pointerEvents: 'none', zIndex: bare ? 5 : undefined }} />}
    </div>
  );
}

function BallReveal({ t, face, cardW, up, rarity, cardHeight, onContinue, ctaLabel, bare, shift, onBadge }) {
  const tm = BALL_T[rarity], L = rarity === 'Legendary';
  const cw = cardW * up, ch = cardHeight * up;
  const S = 132, pitch = S * 0.196, dot = S * 0.1;
  const lit = RAR[rarity].lit;
  const pop = back(P(t, tm.pop, 420));
  const ballOut = eio(P(t, tm.grow, 320));
  const spin = L ? lerp(-18, 0, eo(P(t, 0, 1700))) : lerp(-8, 0, eo(P(t, 0, 900)));
  const order = [0, 1, 2, 5, 8, 7, 6, 3, 4];
  // Legendary charge: the ball swells and shakes harder, then dips just before the burst.
  let csc = 1, sx = 0, sy = 0;
  if (L && t > tm.hold && t < tm.grow) {
    const cp = P(t, tm.hold, tm.grow - tm.hold - 90);
    const ci = cp * cp;
    const dip = eo(P(t, tm.grow - 90, 90));
    csc = lerp(1 + 0.2 * ci, 0.9, dip);
    const a = 6 * ci * (1 - dip * 0.6);
    sx = a * Math.sin(t / 11) + a * 0.5 * Math.sin(t / 5.3);
    sy = a * Math.cos(t / 13) + a * 0.4 * Math.cos(t / 4.7);
  }
  const g = eio(P(t, tm.grow, 440));
  const rv = eio(P(t, tm.reveal, 380));
  const fly = eio(P(t, tm.fly, 440));
  const sk = P(t, tm.strike, 280);
  const sw = S * 0.022;
  const seams = (
    <svg width={S} height={S} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <radialGradient id="crSeam"><stop offset="0.68" stopColor="#fff" stopOpacity="0" /><stop offset="0.85" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0.65" /></radialGradient>
        <mask id="crMask"><circle cx={S / 2} cy={S / 2} r={S / 2} fill="url(#crSeam)" /></mask>
        <clipPath id="crClip"><circle cx={S / 2} cy={S / 2} r={S / 2} /></clipPath>
      </defs>
      <g mask="url(#crMask)" clipPath="url(#crClip)" stroke={INK} strokeWidth={sw} fill="none">
        <ellipse cx={S / 2} cy={S / 2} rx={0.3 * S} ry={0.73 * S} />
        <line x1={S / 2} y1="0" x2={S / 2} y2={S} /><line x1="0" y1={S / 2} x2={S} y2={S / 2} />
      </g>
    </svg>
  );
  const dots = [...Array(9)].map((_, i) => {
    const c = i % 3, r = Math.floor(i / 3), centre = i === 4;
    const lt = P(t, tm.light + order.indexOf(i) * tm.stag, 110);
    const hb = L && centre && t > tm.hold && t < tm.grow ? 0.5 + 0.5 * Math.sin((t - tm.hold) / 90) : 0;
    const bx = (c - 1) * pitch * pop * csc + sx, by = (r - 1) * pitch * pop * csc + sy;
    if (centre) {
      if (g > 0) return null;
      const d = dot * c01(pop) * csc * (1 + 0.5 * Math.sin(Math.PI * lt) + 0.25 * hb);
      return <span key={i} style={{ position: 'absolute', left: bx - d / 2, top: by - d / 2, width: d, height: d, borderRadius: '50%', background: lt > 0 ? lit : STAMP, boxShadow: L && lt > 0 ? `0 0 ${10 + 14 * hb}px ${FR}` : 'none' }} />;
    }
    const ex = (c - 1) * (cw / 2 + 3), ey = (r - 1) * (ch / 2 + 3);
    const x = lerp(bx, ex, fly), y = lerp(by, ey, fly);
    const d = (sk > 0 ? lerp(dot * 1.3, 0, eo(sk)) : lerp(dot, dot * 1.3, fly) * (1 + 0.5 * Math.sin(Math.PI * lt))) * c01(pop);
    const ring = sk > 0 && sk < 1 ? <span style={{ position: 'absolute', left: x - 24 * sk, top: y - 24 * sk, width: 48 * sk, height: 48 * sk, borderRadius: '50%', border: `2px solid ${RAR[rarity].color}`, opacity: 1 - sk }} /> : null;
    return (
      <span key={i}>
        {d > 0.3 && <span style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', background: fly > 0.3 ? RAR[rarity].color : lt > 0 ? lit : INK, boxShadow: L && lt > 0 ? `0 0 10px ${FR}` : 'none' }} />}
        {ring}
      </span>
    );
  });
  const pw = lerp(dot * 1.5, cw, g), ph = lerp(dot * 1.5, ch, g);
  return (
    <Chrome t={t} tm={tm} rarity={rarity} cw={cw} ch={ch} onContinue={onContinue} ctaLabel={ctaLabel} bare={bare} shift={shift} onBadge={onBadge}>
      {ballOut < 1 && (
        <div style={{ position: 'absolute', left: -S / 2, top: -S / 2, width: S, height: S, transform: `translate(${sx}px,${sy}px) scale(${c01(pop) * csc * (1 + 0.4 * ballOut)}) rotate(${spin}deg)`, opacity: 1 - ballOut }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: FILE }} />
          {seams}
        </div>
      )}
      {g > 0 && (
        <div style={{ position: 'absolute', left: -pw / 2, top: -ph / 2, width: pw, height: ph, borderRadius: lerp(pw / 2, 0, eo(c01(g * 1.4))), background: lit, opacity: 1 - c01((rv - 0.8) * 5),
          boxShadow: sk > 0 ? frameShadow(rarity) : 'none' }}
        />
      )}
      {rv > 0 && (
        <div style={{ position: 'absolute', left: -cw / 2, top: -ch / 2, width: cw, height: ch, clipPath: `circle(${rv * 75}% at 50% 50%)`, boxShadow: '0 14px 26px rgba(8,13,26,0.62)' }}>
          <div className="card-reveal-face" style={{ width: cardW, transform: `scale(${up})`, transformOrigin: '0 0' }}>{face}</div>
        </div>
      )}
      {sk > 0 && (
        <div style={{ position: 'absolute', left: -cw / 2, top: -ch / 2, width: cw, height: ch, boxShadow: frameShadow(rarity), transform: `scale(${lerp(1.06, 1, back(sk))})`, pointerEvents: 'none' }}>
          {L && <Sheen t={t} tm={tm} cw={cw} ch={ch} />}
        </div>
      )}
      {dots}
    </Chrome>
  );
}

// The same ball reveal, playable anywhere: centred in its parent box, no ink ground or buttons,
// sped up by `speed` (the player picker runs it 1.5x). `delay` holds the start back a moment.
// Remounting it (change its key) plays it again.
export function CardRevealPlayer({ card, up, cardHeight, speed = 1, delay = 0, settled = false }) {
  const rarity = RAR[card.rarity] ? card.rarity : 'Core';
  const total = BALL_T[rarity].total;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (reduced || settled) return undefined;
    let id;
    const start = performance.now();
    const frame = (now) => {
      const e = now - start;
      setClock(e);
      if ((e - delay) * speed < total) id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [total, reduced, settled, speed, delay]);
  const t = reduced || settled ? total : Math.min(total, Math.max(0, clock - delay) * speed);
  // One element for the card's whole life, so a frame of the animation never re-renders the card.
  const face = useMemo(() => <PlayerCard card={card} />, [card]);
  return <BallReveal t={t} face={face} cardW={264} up={up} rarity={rarity} cardHeight={cardHeight} bare />;
}

const HINT = 'Tap any part of the card to learn more';

// kind: 'player' reveals `card`; 'coach' / 'gm' reveal the Front Office card off `team`.
export default function CardReveal({ kind = 'player', card: dealtCard, team: dealtTeam, onContinue }) {
  const { cardW, up, label } = KINDS[kind];
  // Onboarding always teaches with the Core version of a card — the simplest frame and the
  // shortest reveal — whatever rarity was actually dealt. Display-only copies; the real hand is
  // untouched. (The coach's gameplans are rolled on the real team first so they match the game.)
  const card = useMemo(() => (dealtCard ? { ...dealtCard, rarity: 'Core' } : dealtCard), [dealtCard]);
  const team = useMemo(() => {
    if (!dealtTeam?.coach) return dealtTeam;
    ensureCoachSystems(dealtTeam);
    return { ...dealtTeam, gmRarity: 'Core', coach: { ...dealtTeam.coach, rarity: 'Core' } };
  }, [dealtTeam]);
  // The card's own accolade icon opens an inline, non-modal popover, so the reveal covers it
  // with a region of its own that gives a generic explanation of accolades in the same modal as
  // everything else (never this particular player's accolade).
  const notes = useMemo(() => {
    if (kind !== 'player') return (kind === 'coach' ? COACH_NOTES : GM_NOTES);
    return [...PLAYER_NOTES, {
      key: 'accolades', selector: '.pcard-accolade-block', label: 'Accolades',
      text: 'League honors a player earns over their career, like All-Star or MVP. Each one boosts the player\u2019s stats and shows up as a single icon on the card.',
    }];
  }, [kind]);
  const rarity = 'Core';
  const face = useMemo(() => (kind === 'player' ? <PlayerCard card={card} /> : <FrontOfficeCard kind={kind === 'coach' ? 'coach' : 'market'} team={team} />), [kind, card, team]);
  const tm = BALL_T[rarity];
  // The card is read-ready once its rarity label has landed; a beat later it settles down.
  const readyAt = Math.max(tm.ui + 250, tm.badge + 570);
  const moveStart = readyAt + 250;
  const total = Math.max(tm.total, moveStart + SETTLE_MS + 100);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [clock, setT] = useState(0);
  const t = reduced ? total : clock;
  const [scale, setScale] = useState(1);
  const [cardHeight, setCardHeight] = useState(500);
  const [boxes, setBoxes] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const measureRef = useRef(null);
  const stageRef = useRef(null);
  // Not until the rarity label has finished popping in, so its tap target is measured at rest.
  const ready = t >= readyAt;
  const settle = eo(P(t, moveStart, SETTLE_MS));
  const target = SETTLE[kind];
  const shift = { dy: target.dy * settle, s: lerp(1, target.s, settle) };
  const blurb = BLURBS[kind];
  const blurbIn = eo(P(t, moveStart, 900));
  const shiftRef = useRef({ dy: 0, s: 1 });
  useLayoutEffect(() => { shiftRef.current = shift; });
  const ui = eo(P(t, tm.ui, 500));
  const labelNote = useMemo(() => rarityLabelNote('Core'), []);
  const active = activeKey === 'rarityLabel' ? labelNote : boxes.find((box) => box.key === activeKey);
  // Where the selected region sits on screen (the stage is centred and scaled to fit), so the
  // spotlight can feather around it and the modal can sit right beside it.
  const spot = active && !active.panel ? {
    left: (window.innerWidth - STAGE_W * scale) / 2 + (201 + shift.s * (active.left - 201)) * scale,
    top: (window.innerHeight - STAGE_H * scale) / 2 + (440 + shift.dy + shift.s * (active.top - 440)) * scale,
    width: active.width * shift.s * scale,
    height: active.height * shift.s * scale,
  } : null;
  const modalBelow = spot ? window.innerHeight - (spot.top + spot.height) >= 300 : true;
  const MODAL_GAP = 14;

  // The real card's height varies (accolade rows, signing notes), so measure it off-screen once
  // and size the frame/reveal clip to it rather than the design's fixed mock face.
  useLayoutEffect(() => {
    const el = measureRef.current?.querySelector('.pcard, .fo2-card');
    if (el && el.offsetHeight) setCardHeight(el.offsetHeight);
  }, [card, team, kind]);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H, 1.3));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    let id;
    const start = performance.now();
    const frame = (now) => {
      const e = Math.min(now - start, total);
      setT(e);
      if (e < total) id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [total, reduced]);

  useEffect(() => {
    if (!activeKey) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setActiveKey(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeKey]);

  // Once the card has settled, lay an invisible tappable region over each explained part of the
  // real card. Rects are read in screen space and divided back out by the stage's own scale.
  useLayoutEffect(() => {
    if (!ready) return undefined;
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      const sc = sr.width / STAGE_W || 1;
      setBoxes(notes.flatMap((note) => {
        const el = stage.querySelector((note.global ? '' : '.card-reveal-face ') + note.selector);
        if (!el) return [];
        let r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return [];
        if (note.inset) {
          const size = Math.min(r.width, r.height) * note.inset;
          r = { left: r.left + (r.width - size) / 2, top: r.top + (r.height - size) / 2, width: size, height: size };
        }
        const pad = note.pad ?? 5;
        // Undo the settle shift so the boxes are in the card's own (unshifted) stage coordinates.
        const { dy, s: sh } = shiftRef.current;
        const x = (r.left - sr.left) / sc, y = (r.top - sr.top) / sc;
        return [{ ...note, left: (x - 201) / sh + 201 - pad, top: (y - 440 - dy) / sh + 440 - pad, width: r.width / sc / sh + pad * 2, height: r.height / sc / sh + pad * 2 }];
      }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ready, scale, notes, cardHeight]);

  return (
    <div className="card-reveal-overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div ref={measureRef} className={'card-reveal-measure kind-' + kind} style={{ width: cardW }} aria-hidden="true">{face}</div>
      <div
        ref={stageRef}
        className={'card-reveal-stage kind-' + kind}
        style={{ width: STAGE_W, height: STAGE_H, marginLeft: -STAGE_W / 2, marginTop: -STAGE_H / 2, transform: `scale(${scale})` }}
      >
        <BallReveal t={t} face={face} cardW={cardW} up={up} rarity={rarity} cardHeight={cardHeight} onContinue={onContinue} ctaLabel={kind === 'gm' ? 'START GAME' : 'CONTINUE'} shift={shift} onBadge={() => setActiveKey('rarityLabel')} />
        <div className="card-reveal-blurb" style={{ opacity: blurbIn, transform: `translateY(${lerp(-10, 0, blurbIn)}px)` }}>
          <strong>{blurb.title}</strong>
          <span>{blurb.text}</span>
        </div>
        <div className="card-reveal-hint" style={{ opacity: ui }}>{HINT}</div>
        <div className="card-reveal-hotspots" style={{ transform: `translateY(${shift.dy}px) scale(${shift.s})` }}>
        {ready && boxes.map((box) => (
          <button
            key={box.key}
            type="button"
            className={'card-reveal-hotspot' + (box.key === 'rarityLabel' ? ' rarity-label' : '') + (box.key === activeKey ? ' active' : '')}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            aria-label={`${box.label}: learn more`}
            onClick={() => setActiveKey(box.key)}
          />
        ))}
        </div>
        {t >= tm.badge && (
          <button
            type="button"
            className="card-reveal-badge-hit"
            aria-label="Rarity: Core. Show the rarity scale."
            style={{ right: STAGE_W - (201 + shift.s * (cardW * up / 2 - 8)), top: 440 + shift.dy + shift.s * (-(cardHeight * up) / 2 - 13), transform: `scale(${shift.s})` }}
            onClick={() => setActiveKey('rarityLabel')}
          >CORE</button>
        )}
      </div>
      {spot && !active.panel && (
        <svg className="card-reveal-spotlight" aria-hidden="true">
          <defs>
            <filter id="crSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
            <mask id="crHole">
              <rect width="100%" height="100%" fill="#fff" />
              <rect x={spot.left - 4} y={spot.top - 4} width={spot.width + 8} height={spot.height + 8} rx="8" fill="#000" filter="url(#crSoft)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(18,26,46,0.78)" mask="url(#crHole)" />
        </svg>
      )}
      {active?.panel === 'rarity' && <RarityInfoPanel rarity="Core" onClose={() => setActiveKey(null)} />}
      {active && !active.panel && (
        <div className="card-reveal-modal-backdrop" role="presentation" onClick={() => setActiveKey(null)}>
          <section
            className="card-reveal-modal"
            role="dialog"
            aria-modal="true"
            aria-label={active.label}
            style={modalBelow ? { top: spot.top + spot.height + MODAL_GAP } : { bottom: window.innerHeight - spot.top + MODAL_GAP }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{active.label}</h2>
            <p>{active.text}</p>
            <button type="button" className="primary" autoFocus onClick={() => setActiveKey(null)}>Got It</button>
          </section>
        </div>
      )}
    </div>
  );
}
