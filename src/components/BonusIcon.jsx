import { BONUS_GLYPHS, BONUS_META, BONUS_SIDE } from './bonusIcons';

// One lineup bonus's icon: its glyph on a tile coloured by what it boosts, with tier pips under
// it. `size` is the tile's edge in px (the design draws it at 72). Unknown names render nothing.
export default function BonusIcon({ name, size = 44 }) {
  const meta = BONUS_META[name];
  if (!meta) return null;
  const pips = [5, 10, 15].map((tier) => (meta.pct >= tier ? '#1E2B47' : '#C9BC9C'));
  return (
    <span className="bonus-icon" style={{ width: size }} aria-hidden="true">
      <span
        className="bonus-icon-tile"
        style={{
          width: size, height: size, background: BONUS_SIDE[meta.side].bg,
          borderRadius: meta.shape === 'round' ? '50%' : 0,
          boxShadow: meta.shape === 'framed' ? `inset 0 0 0 ${Math.max(2, size * 0.04)}px #F0A03D` : 'none',
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill="currentColor" style={{ display: 'block', overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: BONUS_GLYPHS[meta.glyph] }} />
      </span>
      <span className="bonus-icon-pips">{pips.map((color, i) => <i key={i} style={{ background: meta.pct === 1 ? '#C9BC9C' : color }} />)}</span>
    </span>
  );
}
