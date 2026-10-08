import { useEffect, useState } from 'react';
import BallMark from './BallMark';
import './CardReveal.css';

// The "cut and slide" deck shuffle (design: Card Reveal, Shuffle 2A). The deck splits into three
// packets; twelve quick cuts slide one packet out to the side while the others drop, then slide
// it back in at a new depth. The deck squares up with a tap, the headline flips to "shuffled"
// and the button appears. Laid out in the design's own 402×874 phone-screen space (the deck's
// centre sits at 201,440) and scaled to fit the viewport, same as CardReveal, so the timings and
// offsets below are the design's numbers untouched.

const INK = '#1E2B47', DEEP = '#17223A', FILE = '#E6DCC4', IMUTED = '#A9B4C9', FR = '#F0A03D';
const c01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
const P = (t, s, d) => c01((t - s) / d);
const eo = (p) => 1 - Math.pow(1 - p, 3);
const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const back = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const STAGE_W = 402, STAGE_H = 874;

const SH = { intro: 0, start: 220, cut: 190, square: 2560, ui: 2680, total: 3100 };
const CUTS = (() => {
  const moves = [[0, 2], [1, 2], [2, 0], [1, 2], [0, 1], [2, 1]];
  let ord = ['A', 'B', 'C'];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const [f, to] = moves[i % moves.length];
    const m = ord[f];
    const next = ord.filter((x) => x !== m);
    next.splice(to, 0, m);
    out.push({ from: ord, to: next, m, dir: 1 });
    ord = next;
  }
  return out;
})();

function CardBack({ s, h }) {
  return (
    <div style={{ width: s, height: h, background: DEEP, boxShadow: `inset 0 0 0 5px ${INK}`, position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 * s / 232, alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(240,160,61,0.09) 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, rgba(240,160,61,0.09) 0 1px, transparent 1px 8px)' }}
    >
      <BallMark size={64 * s / 232} variant="onInk" />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 26 * s / 232, lineHeight: 0.82, letterSpacing: '0.015em', whiteSpace: 'nowrap' }}>
        <span style={{ color: FILE }}>NINE</span> <span style={{ color: FR }}>DEEP</span>
      </span>
    </div>
  );
}

function Shuffle({ t, onDeal }) {
  const s = 220, sh = 390, layers = 4, TH = layers * 3, DX = s * 0.8;
  const intro = eo(P(t, SH.intro, 220));
  const ci = Math.min(CUTS.length - 1, Math.max(0, Math.floor((t - SH.start) / SH.cut)));
  const cut = CUTS[ci];
  const p = t < SH.start ? 0 : c01((t - SH.start - ci * SH.cut) / SH.cut);
  const done = t >= SH.start + CUTS.length * SH.cut;
  const sq = P(t, SH.square, 200);
  const tap = sq > 0 ? lerp(1.035, 1, back(sq)) : 1;
  const ui = eo(P(t, SH.ui, 450));
  const off = (k) => -k * TH;
  const packets = ['A', 'B', 'C'].map((id) => {
    const b = cut.from.indexOf(id), a = cut.to.indexOf(id);
    if (done) return { id, x: 0, y: off(a), r: 0, z: a };
    const yp = eio(P(p, 0.28, 0.42));
    let x = 0, r = 0, z = p < 0.45 ? b : a;
    if (id === cut.m) {
      x = cut.dir * DX * (p < 0.45 ? eo(p / 0.45) : 1 - eio((p - 0.45) / 0.55));
      r = cut.dir * 6 * Math.sin(Math.PI * p);
      if (p < 0.45) z = 5;
    }
    return { id, x, y: lerp(off(b), off(a), yp) - (id === cut.m ? 10 * Math.sin(Math.PI * p) : 0), r, z };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, background: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 92, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.18em', color: IMUTED }}>THE DEAL</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 0.84, color: FILE }}>{ui > 0.5 ? 'DECK SHUFFLED' : 'SHUFFLING THE DECK'}</span>
      </div>
      <div style={{ position: 'absolute', left: 201, top: 440 + TH, width: 0, height: 0, transform: `translateY(${lerp(80, 0, intro)}px) scale(${tap})`, opacity: c01(intro * 2) }}>
        {packets.map((pk) => (
          <div key={pk.id} style={{ position: 'absolute', left: -s / 2, top: -sh / 2, width: s, height: sh, zIndex: pk.z, transform: `translate(${pk.x}px, ${pk.y}px) rotate(${pk.r}deg)` }}>
            {[...Array(layers)].map((_, j) => (
              <div key={j} style={{ position: 'absolute', left: 0, top: -j * 3, boxShadow: j === 0 && pk.z === 0 ? '0 14px 26px rgba(8,13,26,0.62)' : '0 1.5px 0 #0B1222' }}><CardBack s={s} h={sh} /></div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: ui, transform: `translateY(${lerp(14, 0, ui)}px)` }}>
        <button
          type="button"
          onClick={onDeal}
          disabled={ui < 0.6}
          style={{ alignSelf: 'stretch', height: 54, border: 0, background: FILE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-label)', fontSize: 14, letterSpacing: '0.16em', color: INK, cursor: 'pointer' }}
        >DEAL MY HAND</button>
      </div>
    </div>
  );
}

// Plays once on mount, then rests on "Deck shuffled" until the player taps Deal.
export default function DeckShuffle({ onDone }) {
  const [t, setT] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H, 1.3));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    let id;
    const start = performance.now();
    const frame = (now) => {
      const e = Math.min(now - start, SH.total);
      setT(e);
      if (e < SH.total) id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="card-reveal-overlay" role="dialog" aria-modal="true" aria-label="Shuffling the deck">
      <div className="card-reveal-stage" style={{ width: STAGE_W, height: STAGE_H, marginLeft: -STAGE_W / 2, marginTop: -STAGE_H / 2, transform: `scale(${scale})`, cursor: 'default' }}>
        <Shuffle t={t} onDeal={onDone} />
      </div>
    </div>
  );
}
