import { useState } from 'react';
import { createPortal } from 'react-dom';
import CardTypeMark from './CardTypeMark';

const RARITY_DETAILS = {
  Core: 'The most common cards. Reliable building blocks with straightforward impact.',
  Prime: 'Less common cards with stronger traits or effects than Core cards.',
  Signature: 'Rare, high-impact cards that can meaningfully shape a franchise or matchup.',
  Legendary: 'The rarest and most powerful cards in the game.',
};

// The card's rarity mark, enlarged to fill its lower-right quadrant (sized by CSS, aspect ratio
// kept) and faded right back so it reads as a watermark — it never takes clicks and sits well
// under every other element. A direct child of the card, so the quadrant is the card's, not
// whatever section happens to hold the info button.
export function RarityGhost({ rarity = 'Core' }) {
  return <span className="rarity-ghost" aria-hidden="true"><CardTypeMark type={rarity} size={100} /></span>;
}

export default function RarityBadge({ rarity = 'Core' }) {
  const [open, setOpen] = useState(false);
  const close = (event) => { event.stopPropagation(); setOpen(false); };

  return (
    <>
      <button
        type="button"
        className="rarity-icon-button"
        aria-label={`${rarity} rarity. Show rarity information.`}
        title={`${rarity} rarity`}
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
      >
        i
      </button>
      {open && createPortal(
        <div className="rarity-info-backdrop" role="presentation" onClick={close}>
          <section className={`rarity-info-panel rarity-${rarity}`} role="dialog" aria-modal="true" aria-label={`${rarity} rarity information`} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="rarity-info-close" aria-label="Close rarity information" onClick={close}>✕</button>
            <div className="rarity-info-selected">
              <CardTypeMark type={rarity} size={46} />
              <div><span>Card Rarity</span><strong>{rarity}</strong></div>
            </div>
            <p>{RARITY_DETAILS[rarity]}</p>
            <div className="rarity-info-scale">
              {Object.entries(RARITY_DETAILS).map(([name, description]) => (
                <div className={name === rarity ? 'selected' : ''} key={name}>
                  <CardTypeMark type={name} size={24} />
                  <span><b>{name}</b>{description}</span>
                </div>
              ))}
            </div>
            <p className="rarity-info-note">Rarity reflects a card's existing power and scarcity. It does not add a separate bonus.</p>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
