import { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import FrontOfficeCard from '../components/FrontOfficeCard';

const TOURS = {
  player: [
    { focus: 'identity', title: 'Player Identity', body: 'Career stage, modifier, position, grade, jersey number, and archetype identify the player at a glance.' },
    { focus: 'contract', title: 'Cost & Contract', body: 'Cost counts against your annual budget. Turns Remaining shows how long the current contract lasts.' },
    { focus: 'stats', title: 'Player Stats', body: 'Scoring, Playmaking, Rebounding, and Defense determine what this player contributes to your lineup.' },
    { focus: 'skillset', title: 'Skillset', body: 'Skillsets create Synergy when paired with compatible players in your starting five.' },
    { focus: 'rarity', title: 'Rarity & Accolades', body: 'The lower section shows card rarity, league accolades, and whether the player has been developed.' },
  ],
  coach: [
    { focus: 'identity', title: 'Coach Identity', body: 'The coaching style and modifier establish how this coach shapes the franchise.' },
    { focus: 'effects', title: 'Coach Effects', body: 'Review cost, lineup bonuses, relationships, Development Points, and available in-game adjustments.' },
    { focus: 'gameplans', title: 'Gameplans & Rarity', body: 'Each coach provides a primary and secondary Gameplan. Rarity helps determine the strength of coach systems.' },
    { focus: 'detail', title: 'Coach Modifier', body: 'The modifier description explains the coach’s special rule and when it applies.' },
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
