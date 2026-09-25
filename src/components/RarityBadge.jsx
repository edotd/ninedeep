import { useState } from 'react';
import { createPortal } from 'react-dom';
import CardTypeMark from './CardTypeMark';

const RARITY_DETAILS = {
  Core: 'The most common cards. Reliable building blocks with straightforward impact.',
  Prime: 'Less common cards with stronger traits or effects than Core cards.',
  Signature: 'Rare, high-impact cards that can meaningfully shape a franchise or matchup.',
  Legendary: 'The rarest and most powerful cards in the game.',
};

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
        <CardTypeMark type={rarity} size={30} />
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
