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
