import { useEffect, useRef, useState } from 'react';

// Glow tally: whenever a watched metric's own value changes (a lineup swap, a coach hire, a
// signed contract, anything that moves the number), the affected key pulses and briefly shows
// the latest +/- delta. Keep this transient: an old delta should not look like a permanent
// value, and repeatedly summing decimal changes produces floating-point artifacts such as
// 0.0499999998. Shared by FranchiseMasthead (Chemistry/Output/Offense/Defense) and
// SetLineupScreen (its own live Offense/Defense/Bench preview) so both pulse identically.
const PULSE_MS = 1000;
const TALLY_MS = 3000;
const cleanDelta = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded) < 0.01 ? 0 : rounded;
};

export function useMetricTally(values, resetKey) {
  const prevRef = useRef(null);
  const timersRef = useRef({});
  const [tally, setTally] = useState({});
  const [pulsing, setPulsing] = useState({});

  useEffect(() => {
    prevRef.current = null;
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    setTally({});
    setPulsing({});
  }, [resetKey]);

  const signature = JSON.stringify(values);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = values;
    if (!prev) return; // first paint since a reset — nothing to diff against yet
    const changed = Object.keys(values).filter((key) => typeof prev[key] === 'number' && typeof values[key] === 'number' && prev[key] !== values[key]);
    if (!changed.length) return;
    setTally((t) => {
      const next = { ...t };
      changed.forEach((key) => { next[key] = cleanDelta(values[key] - prev[key]); });
      return next;
    });
    setPulsing((p) => ({ ...p, ...Object.fromEntries(changed.map((key) => [key, true])) }));
    changed.forEach((key) => {
      clearTimeout(timersRef.current[`pulse-${key}`]);
      clearTimeout(timersRef.current[`tally-${key}`]);
      timersRef.current[`pulse-${key}`] = setTimeout(() => setPulsing((p) => ({ ...p, [key]: false })), PULSE_MS);
      timersRef.current[`tally-${key}`] = setTimeout(() => setTally((t) => {
        const next = { ...t };
        delete next[key];
        return next;
      }), TALLY_MS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), []);

  return { tally, pulsing };
}
