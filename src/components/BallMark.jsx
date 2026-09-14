// The Nine Deep mark — a basketball built from primitives, per the brand handoff.
// Nine dots (3x3), the centre one carrying the franchise accent, seams reading only at the
// rim (never past ~65% opacity, faded out well before centre via the radial mask below).
const VARIANTS = {
  onInk:        { body: '#E6DCC4', seam: '#1E2B47', centre: '#B5431F' },
  onFile:       { body: '#1E2B47', seam: '#E6DCC4', centre: '#F0A03D' },
  monoOutline:  { body: '#F2EBDC', seam: '#1E2B47', centre: '#1E2B47', ring: '#1E2B47' },
  monoReversed: { body: '#1E2B47', seam: '#E6DCC4', centre: '#E6DCC4' },
};

export default function BallMark({ size = 40, variant = 'onFile', spinning = false }) {
  const c = VARIANTS[variant] || VARIANTS.onFile;
  const S = 100; // internal unit square, scaled by the SVG viewport
  const maskId = `nd-ball-mask-${variant}`;
  const showSeams = size >= 24;
  const showSideSeams = size >= 40;
  const dotStep = S * 0.096 + S * 0.10;
  const dotStart = S / 2 - dotStep;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
      <defs>
        <radialGradient id={maskId} cx="50%" cy="50%" r="50%">
          <stop offset="68%" stopColor="white" stopOpacity="0" />
          <stop offset="85%" stopColor="white" stopOpacity=".22" />
          <stop offset="100%" stopColor="white" stopOpacity=".65" />
        </radialGradient>
        <mask id={`${maskId}-m`}>
          <rect width={S} height={S} fill={`url(#${maskId})`} />
        </mask>
      </defs>
      <circle cx={S / 2} cy={S / 2} r={S / 2} fill={c.body} />
      {c.ring && <circle cx={S / 2} cy={S / 2} r={S / 2 - 1} fill="none" stroke={c.ring} strokeWidth="2" />}
      {showSeams && (
        <g
          stroke={c.seam} strokeWidth={S * 0.022} fill="none" mask={`url(#${maskId}-m)`}
          style={spinning ? { transformOrigin: '50% 50%', animation: 'ball-seam-spin 1.6s linear infinite' } : undefined}
        >
          <line x1={S / 2} y1="0" x2={S / 2} y2={S} />
          <line x1="0" y1={S / 2} x2={S} y2={S / 2} />
          {showSideSeams && (
            <>
              <clipPath id={`${maskId}-clip`}>
                <circle cx={S / 2} cy={S / 2} r={S / 2} />
              </clipPath>
              <g clipPath={`url(#${maskId}-clip)`}>
                <ellipse cx={S / 2} cy={S / 2} rx={S * 0.30} ry={S * 0.73} />
              </g>
            </>
          )}
        </g>
      )}
      <g fill={c.seam}>
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const isCentre = row === 1 && col === 1;
            return (
              <circle
                key={`${row}-${col}`}
                cx={dotStart + col * dotStep}
                cy={dotStart + row * dotStep}
                r={S * 0.05}
                fill={isCentre ? c.centre : c.seam}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}
