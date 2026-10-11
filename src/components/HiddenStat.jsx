import { useMemo } from 'react';

// An unscouted draft prospect's stats aren't shown. Each one hovers as a ghost: the low end of
// its range holds for a moment, then dissolves into the high end, then back again — it never
// settles on the real figure. The range is stable per card and stat and never centred on the real
// value. Only scouting the player (or drafting them) shows the real number.

const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
const seeded = (seed) => {
  let a = hash(seed);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// The low and high ends of the range a stat shows: the real value sits somewhere between them.
export function statBounds(value, seed) {
  const rand = seeded(seed);
  return [Math.max(1, value - (1 + Math.floor(rand() * 3))), value + 1 + Math.floor(rand() * 3)];
}

export function HiddenStat({ value, seed }) {
  const { lo, hi, delay } = useMemo(() => {
    const [low, high] = statBounds(value, seed);
    return { lo: low, hi: high, delay: -seeded(seed + ':phase')() * 4.4 };
  }, [value, seed]);
  return (
    <span className="gs" role="img" aria-label="Hidden until scouted">
      <span className="gs-v gs-lo" style={{ animationDelay: `${delay}s` }}>{lo}</span>
      <span className="gs-v gs-hi" style={{ animationDelay: `${delay}s` }}>{hi}</span>
    </span>
  );
}
