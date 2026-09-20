import { useEffect, useMemo, useState } from 'react';

// A reusable 3D die visual, per the "Nine Deep Die" design doc — always drawn as a cube
// regardless of the actual `sides`, since a true d8/d12 polyhedron isn't worth the complexity
// here: the number on the front face is what actually matters (the value in play), not whether
// the shape matches a real die. The front face is amber-filled and always carries `value`; the
// two visible side faces show two other numbers from the same 1..sides range so a bigger die
// still "reads right" before it rolls. The resting pose is fixed — every value lands in the
// same three-quarter view, nothing cants to a different corner per value.

// How long a roll takes, start to settle — shared with the CSS keyframe (nd-die-roll, same
// duration) so the cube's spin and the front face's flicker both finish at the same instant,
// and with any caller that needs to time a phase change around a roll actually finishing.
export const ROLL_DURATION_MS = 900;

function otherFaceValues(sides, value) {
  const pool = [];
  for (let i = 1; i <= sides; i++) if (i !== value) pool.push(i);
  if (!pool.length) return [value, value];
  const top = pool[Math.floor(pool.length / 3) % pool.length];
  const right = pool[Math.floor((pool.length * 2) / 3) % pool.length];
  return [top, right];
}

function randomFace(sides, exclude) {
  if (sides <= 1) return 1;
  let v;
  do { v = 1 + Math.floor(Math.random() * sides); } while (v === exclude);
  return v;
}

// `rolling` plays one roll: the cube spins continuously in a single direction (never reversing
// or snapping back mid-roll) through an ease-out curve — fast at first, decelerating to a
// stop exactly at its fixed rest pose after ROLL_DURATION_MS — while the front face flickers
// through random values on the same decelerating cadence, landing on the real `value` right as
// the spin settles.
export default function Die({ sides = 6, value = 1, size = 120, rolling = false }) {
  const [tumbleValue, setTumbleValue] = useState(value);

  useEffect(() => {
    if (!rolling) return undefined;
    let cancelled = false;
    let timeoutId;
    let elapsed = 0;
    let delay = 55;
    const tick = () => {
      if (cancelled) return;
      setTumbleValue((prev) => randomFace(sides, prev));
      elapsed += delay;
      delay = Math.min(delay * 1.4, 200);
      if (elapsed < ROLL_DURATION_MS - 80) timeoutId = setTimeout(tick, delay);
    };
    timeoutId = setTimeout(tick, delay);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [rolling, sides]);

  const shownValue = rolling ? tumbleValue : value;
  const [topValue, rightValue] = useMemo(() => otherFaceValues(sides, shownValue), [sides, shownValue]);

  return (
    <div className={'nd-die' + (rolling ? ' rolling' : '')} style={{ '--die-size': `${size}px` }}>
      <div className="nd-die-cube">
        <div className="nd-die-face nd-die-top">{topValue}</div>
        <div className="nd-die-face nd-die-right">{rightValue}</div>
        <div className="nd-die-face nd-die-front" key={shownValue}>{shownValue}</div>
      </div>
    </div>
  );
}
