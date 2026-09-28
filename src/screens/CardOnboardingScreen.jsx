import { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';

const TOURS = {
  player: [
    { focus: 'archetype', title: 'Archetype', body: "No portraits in this game, so this is the card's identity — the number next to it is how the persistent bar shows this player in their slot." },
    { focus: 'stats', title: 'Stats', body: 'Scoring, Playmaking, Rebounding, and Defense determine what this player contributes to your lineup.' },
    { focus: 'skillset', title: 'Skillset', body: 'A permanent trait rolled once at creation. Two starters sharing a Skillset pairing unlock a chemistry bonus.' },
    { focus: 'turns', title: 'Turns Remaining', body: 'Each filled dot is one turn left on the contract. At zero, the player enters free agency.' },
    { focus: 'stage', title: 'Career Stage', body: 'Young, Prime, or Declining — a fixed career roll that sets a bonus or penalty on every stat this player has.' },
    { focus: 'tier', title: 'Tier', body: "The player's background, from Undrafted to a decorated veteran — flavor and context, independent of their actual stats." },
    { focus: 'position', title: 'Position', body: 'Guard, Forward, or Big. Your starting five needs at least one of each.' },
    { focus: 'grade', title: 'Grade', body: "A single letter summarizing this player's overall quality, at a glance." },
    { focus: 'cost', title: 'Cost', body: 'The largest figure on the card, and the one this player gets traded on. It charges the budget every season the contract runs.' },
  ],
  coach: [
    { focus: 'type', title: 'Type', body: "The coach's archetype — who they are, independent of the specific trait rolled below." },
    { focus: 'modifier', title: 'Modifier', body: 'The one trait that makes this coach distinct — the headline word for the whole card, explained in full at the bottom.' },
    { focus: 'offbonus', title: 'Offensive Bonus and Die', body: "This coach's Offense bonus, shown as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
    { focus: 'defbonus', title: 'Defensive Bonus and Die', body: "This coach's Defense bonus, shown as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
    { focus: 'gameplan', title: 'Gameplan', body: 'Every coach permanently holds two Gameplans, Primary and Secondary — pick one per season on the Set Lineup screen for a team-wide bonus.' },
    { focus: 'relations', title: 'Player Relations', body: 'How well this coach works with the roster — a stronger relationship adds to both the Offense and Defense bonus above.' },
    { focus: 'development', title: 'Development Points', body: 'Points awarded each season to permanently improve a player’s stats, in whichever categories this coach’s style favors.' },
    { focus: 'adjustments', title: 'In-Game Adjustments', body: 'How many Adjustment cards this coach rolls fresh at the start of every playoff match.' },
  ],
  gm: [
    { focus: 'identity', title: 'General Manager', body: 'Every GM shares the General Manager card type, while rarity and traits make each one different.' },
    { focus: 'effects', title: 'Budget & Trait', body: 'The GM card shows its cost and trait value. Only a Cap Architect increases the franchise budget.' },
    { focus: 'detail', title: 'GM Trait', body: 'The trait description explains how this GM changes scouting, contracts, continuity, or available budget.' },
    { focus: 'gameplans', title: 'GM Rarity', body: 'Rarity controls the range of the GM trait. Higher rarity can produce a stronger effect.' },
  ],
};

export default function CardOnboardingScreen({ type, team, onComplete }) {
  const [step, setStep] = useState(0);
  const tour = TOURS[type] || TOURS.player;
  const safeStep = Math.min(Math.max(0, step), tour.length - 1);
  const item = tour[safeStep] || TOURS.player[0];
  const last = safeStep >= tour.length - 1;
  // Use the rendered step rather than a functional increment. Two taps before the next render
  // now both request the same next index instead of advancing twice and escaping the tour.
  const next = () => last ? onComplete() : setStep(Math.min(safeStep + 1, tour.length - 1));
  const card = team.hand?.[0];

  return (
    <main className="card-onboarding-screen">
      <div className="card-onboarding-heading">
        <span>Card Guide · {safeStep + 1} of {tour.length}</span>
        <h1>{type === 'player' ? 'Player Card' : type === 'coach' ? 'Coach Card' : 'GM Card'}</h1>
      </div>
      <div className="card-onboarding-stage">
        <div className="card-onboarding-card">
          {type === 'player' && card && <PlayerCard card={card} onboardingFocus={item.focus} />}
          {type === 'coach' && <FrontOfficeCard kind="coach" team={team} onboardingFocus={item.focus} />}
          {type === 'gm' && <FrontOfficeCard kind="market" team={team} onboardingFocus={item.focus} />}
        </div>
        <section className="card-onboarding-copy" aria-live="polite">
          <h2>{item.title}</h2>
          <p>{item.body}</p>
          <div className="card-onboarding-actions">
            <button type="button" className="reset-link" onClick={onComplete}>Skip</button>
            <button type="button" className="primary" onClick={next}>{last ? 'Continue' : 'Next'}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
