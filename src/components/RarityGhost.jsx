import CardTypeMark from './CardTypeMark';

// The card's rarity mark, enlarged to fill its lower-right quadrant (sized by CSS, aspect ratio
// kept) and faded right back so it reads as a watermark — it never takes clicks and sits well
// under every other element. A direct child of the card, so the quadrant is the card's own.
export default function RarityGhost({ rarity = 'Core' }) {
  return <span className="rarity-ghost" aria-hidden="true"><CardTypeMark type={rarity} size={100} /></span>;
}
