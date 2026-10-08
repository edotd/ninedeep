import { useEffect, useState } from 'react';
import BallMark from './BallMark';

// The "cut and slide" deck shuffle (design: Card Reveal, Shuffle 2A), played right on the deal
// stage so shuffling and dealing read as one continuous beat: the deck splits into three packets,
// a handful of quick cuts slide one packet out to the side while the others drop, then slide it
// back in at a new depth, and the deck squares up with a tap. That squared stack is the same
// stack the deal then peels cards off of (DealScreen keeps rendering it, settled).

const INK = '#1E2B47', DEEP = '#17223A', FILE = '#E6DCC4', FR = '#F0A03D';
const c01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
const P = (t, s, d) => c01((t - s) / d);
const eo = (p) => 1 - Math.pow(1 - p, 3);
const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const back = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

// The design runs twelve 190ms cuts (about 3s); this is the short version — six brisk cuts.
const CUT_COUNT = 6;
const SH = { intro: 0, start: 120, cut: 150, square: 0, total: 0 };
SH.square = SH.start + CUT_COUNT * SH.cut;
SH.total = SH.square + 220;

const CUTS = (() => {
  const moves = [[0, 2], [1, 2], [2, 0], [1, 2], [0, 1], [2, 1]];
  let ord = ['A', 'B', 'C'];
  const out = [];
  for (let i = 0; i < CUT_COUNT; i++) {
    const [f, to] = moves[i % moves.length];
    const m = ord[f];
    const next = ord.filter((x) => x !== m);
    next.splice(to, 0, m);
    out.push({ from: ord, to: next, m, dir: 1 });
    ord = next;
  }
  return out;
})();

// A card back at any size — the deal's flying cards use it too, so every card in the beat matches.
export function CardBack({ s, h }) {
  return (
    <div style={{ width: s, height: h, background: DEEP, boxShadow: `inset 0 0 0 ${Math.max(2, 5 * s / 232)}px ${INK}`, position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 * s / 232, alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(240,160,61,0.09) 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, rgba(240,160,61,0.09) 0 1px, transparent 1px 8px)' }}
    >
      <BallMark size={64 * s / 232} variant="onInk" />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 26 * s / 232, lineHeight: 0.82, letterSpacing: '0.015em', whiteSpace: 'nowrap' }}>
        <span style={{ color: FILE }}>NINE</span> <span style={{ color: FR }}>DEEP</span>
      </span>
    </div>
  );
}

const S = 160, SHT = 224, LAYERS = 4, TH = LAYERS * 3, DX = S * 0.55;

function Stack({ t }) {
  const intro = eo(P(t, SH.intro, 180));
  const ci = Math.min(CUTS.length - 1, Math.max(0, Math.floor((t - SH.start) / SH.cut)));
  const cut = CUTS[ci];
  const p = t < SH.start ? 0 : c01((t - SH.start - ci * SH.cut) / SH.cut);
  const done = t >= SH.start + CUTS.length * SH.cut;
  const sq = P(t, SH.square, 180);
  const tap = sq > 0 ? lerp(1.035, 1, back(sq)) : 1;
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
    return { id, x, y: lerp(off(b), off(a), yp) - (id === cut.m ? 8 * Math.sin(Math.PI * p) : 0), r, z };
  });
  return (
    <div style={{ position: 'absolute', left: '50%', top: `calc(50% + ${TH}px)`, width: 0, height: 0, transform: `translateY(${lerp(40, 0, intro)}px) scale(${tap})`, opacity: c01(intro * 2) }}>
      {packets.map((pk) => (
        <div key={pk.id} style={{ position: 'absolute', left: -S / 2, top: -SHT / 2, width: S, height: SHT, zIndex: pk.z, transform: `translate(${pk.x}px, ${pk.y}px) rotate(${pk.r}deg)` }}>
          {[...Array(LAYERS)].map((_, j) => (
            <div key={j} style={{ position: 'absolute', left: 0, top: -j * 3, boxShadow: j === 0 && pk.z === 0 ? '0 14px 26px rgba(8,13,26,0.62)' : '0 1.5px 0 #0B1222' }}><CardBack s={S} h={SHT} /></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Fills its positioned parent (the deal deck). Plays once, then rests squared; `skip` starts squared.
export default function DeckShuffle({ onDone, skip = false }) {
  const [t, setT] = useState(skip ? SH.total : 0);

  useEffect(() => {
    if (skip) return undefined;
    let id;
    const start = performance.now();
    const frame = (now) => {
      const e = Math.min(now - start, SH.total);
      setT(e);
      if (e < SH.total) id = requestAnimationFrame(frame);
      else onDone?.();
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  return <Stack t={t} />;
}
