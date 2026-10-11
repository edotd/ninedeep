import { memo, useMemo } from 'react';

// An unscouted draft prospect's numbers aren't shown: each stat (and the grade) instead rolls
// through a range of plausible values, forever, like a slot reel. The range is stable per card
// and stat, never centred on the real value, and the animation never lands — only scouting the
// player (or drafting them) shows the real figure.

const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
const seeded = (seed) => {
  let a = hash(seed);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const shuffled = (list, rand) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

// The values a stat will roll through: the real one somewhere inside a window of 3–7 numbers.
export function statRolls(value, seed) {
  const rand = seeded(seed);
  const lo = Math.max(1, value - (1 + Math.floor(rand() * 3)));
  const hi = value + 1 + Math.floor(rand() * 3);
  return shuffled(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), rand);
}

const GRADES = ['F', 'D', 'C', 'B', 'A', 'A+'];
export function gradeRolls(grade, seed) {
  const at = GRADES.indexOf(grade);
  const lo = Math.max(0, at - 1), hi = Math.min(GRADES.length - 1, at + 1);
  return shuffled(GRADES.slice(lo, hi + 1), seeded(seed));
}

const Reel = memo(function Reel({ values, seed }) {
  const rand = useMemo(() => seeded(seed + ':speed'), [seed]);
  const step = useMemo(() => 0.13 + rand() * 0.1, [rand]); // seconds per number
  const delay = useMemo(() => -rand() * values.length * step, [rand, values.length, step]);
  return (
    <span className="hs" aria-label="Unscouted — hidden">
      <span className="hs-reel" style={{ '--n': values.length, animationDuration: `${values.length * step}s`, animationDelay: `${delay}s` }} aria-hidden="true">
        {[...values, ...values].map((v, i) => <i key={i}>{v}</i>)}
      </span>
    </span>
  );
});

export function HiddenStat({ value, seed }) { return <Reel values={useMemo(() => statRolls(value, seed), [value, seed])} seed={seed} />; }
export function HiddenGrade({ grade, seed }) { return <Reel values={useMemo(() => gradeRolls(grade, seed), [grade, seed])} seed={seed} />; }
