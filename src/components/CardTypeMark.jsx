// The three type marks, per the brand handoff's "Pre-deal landing (3A)" — the only
// iconography in the system, existing solely to tell the three card types apart at a glance.
// 60x60 viewBox, 2.5 stroke, single colour via currentColor (set `color` on a parent, or pass
// `color` here directly) so the same mark can sit on either an ink or a file/form ground.
const PATHS = {
  player: (
    <>
      <path d="M20 8l-12 7 5 11 7-4v30h20V22l7 4 5-11-12-7z" strokeWidth="2.5" />
      <path d="M20 8c0 5 4 8 10 8s10-3 10-8" strokeWidth="2.5" />
      <rect x="22" y="32" width="16" height="4" fill="currentColor" stroke="none" />
    </>
  ),
  frontoffice: (
    <>
      <rect x="10" y="9" width="40" height="46" strokeWidth="2.5" />
      <path d="M23 9V5h14v4" strokeWidth="2.5" />
      <rect x="24" y="2" width="12" height="7" fill="currentColor" stroke="none" />
      <path d="M18 24h24M18 33h24M18 42h13" strokeWidth="2.5" />
    </>
  ),
  matchup: (
    <>
      <circle cx="15" cy="30" r="9.5" strokeWidth="2.5" />
      <path d="M38 21l14 18M52 21L38 39" strokeWidth="2.5" />
      <path d="M30 8v10M30 25v10M30 42v10" strokeWidth="2.5" />
    </>
  ),
  // Gameplan cards get their own clipboard-with-checkmark mark (distinct from Front Office's
  // plain-ruled clipboard) — used on the mobile persistent bar and the live match board's
  // gameplan dock in place of a tiny, illegible scaled-down StrategyCard.
  gameplan: (
    <>
      <rect x="14" y="10" width="32" height="42" strokeWidth="2.5" />
      <path d="M24 10V6h12v4" strokeWidth="2.5" />
      <rect x="22" y="3" width="16" height="8" fill="currentColor" stroke="none" />
      <path d="M20 27l6 6 13-15" strokeWidth="2.5" />
    </>
  ),
  // League accolades (game/constants.js's LEAGUE_ACCOLADES) — one mark per honor, shown on
  // PlayerCard in place of the full name (still available via a hover/long-press tooltip) so a
  // decorated player's card doesn't need a whole text row to say so.
  'All-Star': (
    <path d="M30 6l7 16 17 2-13 12 4 17-15-9-15 9 4-17-13-12 17-2z" strokeWidth="2.5" strokeLinejoin="round" />
  ),
  'All-League Defensive Team': (
    <>
      <path d="M30 6l20 8v14c0 14-9 22-20 26-11-4-20-12-20-26V14z" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 30l7 7 13-15" strokeWidth="2.5" />
    </>
  ),
  'All-League 2nd Team': (
    <>
      <circle cx="30" cy="24" r="15" strokeWidth="2.5" />
      <path d="M21 37l-6 17 10-4 6 10 6-16" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="30" y="30" fontSize="17" fontFamily="var(--font-display)" textAnchor="middle" fill="currentColor" stroke="none">2</text>
    </>
  ),
  'All-League 1st Team': (
    <>
      <circle cx="30" cy="24" r="15" strokeWidth="2.5" />
      <path d="M21 37l-6 17 10-4 6 10 6-16" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="30" y="30" fontSize="17" fontFamily="var(--font-display)" textAnchor="middle" fill="currentColor" stroke="none">1</text>
    </>
  ),
  'Defensive Player of the Year': (
    <>
      <path d="M30 6l20 8v14c0 14-9 22-20 26-11-4-20-12-20-26V14z" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 16v9M30 33v9" strokeWidth="2.5" />
      <circle cx="30" cy="25" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'Scoring Champion': (
    <path d="M30 6c-9 11-15 18-15 28a15 15 0 0030 0c0-5-3-9-7-12 1 4-1 7-4 7-3 0-5-2-5-6 0-5 2-10 1-17z" strokeWidth="2.5" strokeLinejoin="round" />
  ),
  'Rebounding Champion': (
    <>
      <circle cx="30" cy="34" r="14" strokeWidth="2.5" />
      <path d="M30 20V8M23 15l7-7 7 7" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 30q12 8 24 0" strokeWidth="2" />
    </>
  ),
  'Assist Leader': (
    <>
      <circle cx="17" cy="38" r="9" strokeWidth="2.5" />
      <path d="M28 22h18M39 14l7 8-7 8" strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  'Most Valuable Player': (
    <>
      <path d="M10 46l4-25 11 13 5-19 5 19 11-13 4 25z" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 46h40" strokeWidth="2.5" />
    </>
  ),
  // Card rarity (game/constants.js's RARITIES) — one mark per tier, shown at low opacity in a
  // card's lower-right corner (see .rarity-icon-mark) alongside the frame's own border
  // color/weight and corner brackets, so rarity still reads even at a size too small for those.
  Core: <circle cx="30" cy="30" r="16" strokeWidth="2.5" />,
  Prime: <path d="M30 10L50 30L30 50L10 30Z" strokeWidth="2.5" strokeLinejoin="round" />,
  Signature: (
    <path
      d="M30 8L35.29 22.72L50.92 23.20L38.56 32.78L42.93 47.80L30 39L17.07 47.80L21.44 32.78L9.08 23.20L24.71 22.72Z"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  ),
  Legendary: (
    <>
      <path d="M12 40V26l8 8 10-18 10 18 8-8v14z" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="12" y="40" width="36" height="8" strokeWidth="2.5" />
      <circle cx="12" cy="26" r="2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="16" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="48" cy="26" r="2" fill="currentColor" stroke="none" />
    </>
  ),
};
// Adjustment cards are this game's matchup cards — same mark, clearer name at the call site.
PATHS.adjustment = PATHS.matchup;

export default function CardTypeMark({ type, size = 18, color, style, className }) {
  return (
    <svg
      viewBox="0 0 60 60"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      className={className}
      style={{ color, flexShrink: 0, ...style }}
    >
      {PATHS[type]}
    </svg>
  );
}
