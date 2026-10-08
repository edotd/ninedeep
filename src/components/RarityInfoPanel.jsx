import CardTypeMark from './CardTypeMark';
import { RARITY_DETAILS } from './playerCardNotes';

// The rarity ladder: the selected rarity up top, then all four laid out in order. Reached by
// tapping the rarity label on a revealed card during onboarding.
export default function RarityInfoPanel({ rarity = 'Core', onClose }) {
  const close = (event) => { event.stopPropagation(); onClose(); };
  return (
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
    </div>
  );
}
