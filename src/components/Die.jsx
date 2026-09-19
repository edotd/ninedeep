import { useMemo } from 'react';

// A reusable 3D die visual, per the "Nine Deep Die" design doc — always drawn as a cube
// regardless of the actual `sides`, since a true d8/d12 polyhedron isn't worth the complexity
// here: the number on the front face is what actually matters (the value in play), not whether
// the shape matches a real die. The front face is amber-filled and always carries `value`; the
// two visible side faces show two other numbers from the same 1..sides range so a bigger die
// still "reads right" before it rolls. The resting pose is fixed — every value lands in the
// same three-quarter view, nothing cants to a different corner per value.
function otherFaceValues(sides, value) {
  const pool = [];
  for (let i = 1; i <= sides; i++) if (i !== value) pool.push(i);
  if (!pool.length) return [value, value];
  const top = pool[Math.floor(pool.length / 3) % pool.length];
  const right = pool[Math.floor((pool.length * 2) / 3) % pool.length];
  return [top, right];
}

export default function Die({ sides = 6, value = 1, size = 120 }) {
  const [topValue, rightValue] = useMemo(() => otherFaceValues(sides, value), [sides, value]);
  return (
    <div className="nd-die" style={{ '--die-size': `${size}px` }}>
      <div className="nd-die-cube">
        <div className="nd-die-face nd-die-top">{topValue}</div>
        <div className="nd-die-face nd-die-right">{rightValue}</div>
        <div className="nd-die-face nd-die-front" key={value}>{value}</div>
      </div>
    </div>
  );
}
