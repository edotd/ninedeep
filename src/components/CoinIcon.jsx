import { useId } from 'react';

// The coin beside a player's cost, drawn as a proper coin (rim, inner ring, embossed ball) rather
// than the emoji. `rank`: 'high' (the team's costliest player — shiny gold with a sweeping gleam),
// 'low' (its cheapest — bronze) or nothing (plain gold).
const PALETTES = {
  high: ['#8A5C05', '#E8B923', '#FFF3B0', '#E8B923', '#8A5C05'],
  low: ['#5E3410', '#B87333', '#E6AE72', '#B87333', '#5E3410'],
  none: ['#9C6A12', '#F0A03D', '#FFD58A', '#F0A03D', '#9C6A12'],
};

export default function CoinIcon({ rank }) {
  const id = useId().replace(/:/g, '');
  const colors = PALETTES[rank] || PALETTES.none;
  const edge = rank === 'low' ? '#3F2208' : rank === 'high' ? '#6B4503' : '#7A4F0A';
  return (
    <svg className={'pcard-coin-svg' + (rank ? ` ${rank}` : '')} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={`cg${id}`} x1="0" y1="0" x2="1" y2="1">
          {colors.map((c, i) => <stop key={i} offset={`${i * 25}%`} stopColor={c} />)}
        </linearGradient>
        <clipPath id={`cc${id}`}><circle cx="12" cy="12" r="11" /></clipPath>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#cg${id})`} stroke={edge} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.8" fill="none" stroke={edge} strokeOpacity="0.55" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="3.1" fill={edge} fillOpacity="0.5" />
      <path d="M5.2 8.4 A8.2 8.2 0 0 1 12 3.8" fill="none" stroke="#fff" strokeOpacity={rank === 'high' ? 0.8 : 0.45} strokeWidth="1.3" strokeLinecap="round" />
      {rank === 'high' && (
        <g clipPath={`url(#cc${id})`}>
          <rect className="coin-gleam" x="-8" y="-4" width="5" height="32" fill="#fff" fillOpacity="0.75" transform="rotate(20 12 12)" />
        </g>
      )}
    </svg>
  );
}
