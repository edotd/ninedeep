import CardTypeMark from './CardTypeMark';

// Matchup card, per the brand handoff's "Components: Front Office & Matchup Cards" — square,
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

export default function MatchupCard({ card, playoff }) {
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
