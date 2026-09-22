import CardTypeMark from './CardTypeMark';

// Adjustment card, per the brand handoff's "Components: Front Office & Adjustment Cards" — square,
// stamp-bordered, torn bottom edge. The spec's two fixed bottom rows ("IF UNANSWERED" /
// "COUNTER") are written for a card imposed on you by an opponent; in this game every
// matchup card sits in your own hand and you choose whether to play it, so the copy below
// reframes the same two rows as "what this does to its target" and "what stops it" — new
// text authored per card name (not present in the game data), a judgment call to fit the
// template rather than invent new labels.
const CONSEQUENCES = {
  'Injury (Minor)': { ifUnanswered: 'Random active player forced out — a same-position bench player subs in if available', counter: 'Injury Prevention held ready, value at least as high' },
  'Injury (Major)': { ifUnanswered: 'Random active player forced out — a same-position bench player subs in if available', counter: 'Injury Prevention held ready, value at least as high' },
  'Distraction (External)': { ifUnanswered: "Offense or Defense (whichever is hit is random) cut by the card's percent", counter: 'None — resolves automatically' },
  'Distraction (Internal)': { ifUnanswered: "Offense or Defense (whichever is hit is random) cut by the card's percent", counter: 'None — resolves automatically' },
  'Player Suspension': { ifUnanswered: "Suspended for the matchup on a low d10 roll against the card's value", counter: 'Beat the roll' },
  'Biased Officiating': { ifUnanswered: 'Offense or Defense (random) cut by a flat 2', counter: 'None' },
  'Injury Prevention': { ifUnanswered: 'Not held ready — offers no protection this matchup', counter: 'Hold it ready before the matchup begins' },
  'Focused Film Session': { ifUnanswered: 'No effect — played on your own team', counter: 'None' },
  'Strategic Advantage': { ifUnanswered: 'No effect — played on your own team', counter: 'None' },
  'Divine Intervention': { ifUnanswered: 'No effect — played on your own team', counter: 'None' },
  'Favorable Schedule': { ifUnanswered: 'Passive — always boosts your seeding roll', counter: 'None' },
  'Team Chemistry': { ifUnanswered: 'Passive — always boosts your bench score 50%', counter: 'None' },
};

// Corner brackets per rarity — real DOM elements rather than ::before/::after, since
// Signature and Legendary need all four corners and a pseudo-element only gives two. Core
// gets none; Prime gets the top two only (the "register brackets" per the handoff).
const CORNERS = {
  Core: [],
  Prime: ['tl', 'tr'],
  Signature: ['tl', 'tr', 'bl', 'br'],
  Legendary: ['tl', 'tr', 'bl', 'br'],
};

// A stable per-card serial within its rarity's flavor print run (2500/1200/400/60) — deterministic
// from the card's own id so it doesn't reshuffle on every render.
const PRINT_RUN = { Core: 2500, Prime: 1200, Signature: 400, Legendary: 60 };
function serialFor(card) {
  const run = PRINT_RUN[card.rarity] || 2500;
  let h = 0;
  const key = String(card.id ?? card.definitionId ?? card.name);
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return String((h % run) + 1).padStart(String(run).length, '0');
}

// `justDealt` plays the rarity's deal-in animation once (see the design handoff's "Dealing a
// rarity") — Legendary gets the full treatment (hold, corner snap, badge bloom, glow, two
// sheen passes); the animation classes below are additive and fill-mode:both, so once they
// finish the card is left showing exactly its normal resting styles — no cleanup needed, and
// a card rendered with justDealt=false (anywhere outside the one reveal moment) just shows
// that resting state immediately. The literal 3D flip-off-a-face-down-back from the spec is
// skipped — this game has no card-back render for matchup cards to flip from, the same scope
// cut made earlier for the player/front-office deal animation.
export default function MatchupCard({ card, playoff, justDealt }) {
  if (card.effectType) {
    const rarity = card.rarity || 'Core';
    const legendary = rarity === 'Legendary';
    const dealCls = justDealt ? ' dealing' : '';
    return (
      <div className="mu2-wrap">
        <div className={'mu2-card' + (playoff ? ' playoff' : '') + dealCls} data-rarity={rarity}>
          {legendary && <div className={'mu2-glow' + dealCls} />}
          <div className="mu2-header"><span className="mu2-kind-group"><CardTypeMark type="matchup" size={16} />{card.category}</span><span>{card.rarity}</span></div>
          <div className="mu2-name">{card.name}</div>
          <p className="mu2-statement">{card.description}</p>
          <div className="mu2-rows">
            <div className="mu2-row"><span className="mu2-row-label">Target</span><span className="mu2-row-value">{card.target === 'self' ? 'Your team' : 'Opponent'}{card.targetsPlayer ? ' · choose player and stat' : ''}</span></div>
            <div className="mu2-row"><span className="mu2-row-label">Timing</span><span className="mu2-row-value">{card.used ? 'Used' : card.passive === 'seeding' ? 'Automatic at seeding' : 'Play once · this matchup'}</span></div>
          </div>
          <div className="mu2-torn" />
          {(CORNERS[rarity] || []).map((c) => <span key={c} className={'mu2-corner ' + c + dealCls} />)}
          {legendary && <div className={'mu2-badge' + dealCls}>Legendary</div>}
          {legendary && <div className={'mu2-serial' + dealCls}>#{serialFor(card)} / {PRINT_RUN.Legendary}</div>}
          {legendary && justDealt && (
            <>
              <div className="mu2-sheen s1" />
              <div className="mu2-sheen s2" />
            </>
          )}
        </div>
      </div>
    );
  }
  const consequence = CONSEQUENCES[card.name] || { ifUnanswered: '—', counter: '—' };
  return (
    <div className="mu2-wrap">
      <div className={'mu2-card' + (playoff ? ' playoff' : '')}>
        <CardTypeMark type="matchup" className="mu2-watermark" color={playoff ? 'var(--ink-rule)' : 'var(--file-rule)'} size={170} />
        <div className="mu2-header">
          <span className="mu2-kind-group"><CardTypeMark type="matchup" size={16} />Matchup</span>
          <span>One Game</span>
        </div>
        <div className="mu2-name">{card.name}</div>
        <p className="mu2-statement">{card.flavor}</p>
        <div className="mu2-rows">
          <div className="mu2-row mu2-row-bad">
            <span className="mu2-row-label">If Unanswered</span>
            <span className="mu2-row-value bad">{consequence.ifUnanswered}</span>
          </div>
          <div className="mu2-row mu2-row-good">
            <span className="mu2-row-label">Counter</span>
            <span className="mu2-row-value good">{consequence.counter}</span>
          </div>
        </div>
        <div className="mu2-torn" />
      </div>
      <ul className="mu2-bullets">
        <li>If unanswered: {consequence.ifUnanswered}</li>
        <li>Counter: {consequence.counter}</li>
        {card.value != null && <li>Value: {card.value}{card.valueDie ? ` (beats 1d${card.valueDie})` : ''}</li>}
      </ul>
    </div>
  );
}
