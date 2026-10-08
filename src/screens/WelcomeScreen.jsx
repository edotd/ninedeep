import { useState } from 'react';
import BallMark from '../components/BallMark';
import CardReveal from '../components/CardReveal';
import './WelcomeScreen.css';

const LAST_STEP = 'ready';

// Steps (driven by GameShell): welcome -> cards -> [Learn More / Start Playing dialog] ->
// reveal -> players -> coachgm -> ready. "Start Playing" in the dialog skips straight to the deal.
export default function WelcomeScreen({ teamName, onContinue, onStartPlaying, step = 'welcome', revealCard }) {
  const [choosing, setChoosing] = useState(false);

  if (step === 'reveal' && revealCard) return <CardReveal card={revealCard} onContinue={onContinue} />;

  const isLast = step === LAST_STEP;
  const handleNext = () => (step === 'cards' ? setChoosing(true) : onContinue());
  return (
    <main className="welcome-screen">
      <section className="welcome-file">
        <div className="welcome-lockup" aria-label="Nine Deep">
          <BallMark size={54} variant="onInk" />
        </div>
        <div className="welcome-copy">
          {step === 'welcome' && (
            <>
              <h1>How It Works</h1>
              <p>You've been handed the keys to <strong className="welcome-franchise-name">{teamName}</strong> and given one directive: win championships. Eight other franchises have the same goal - can you outlast the competition and cement your place in the history books?</p>
            </>
          )}
          {step === 'cards' && (
            <>
              <h1>The Cards</h1>
              <p>At the start of the game each player receives nine cards. Five starters, two bench players, a coach and a GM.</p>
              <div className="welcome-card-fan" aria-label="Seven player cards, one coach card, and one general manager card">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="welcome-mini-card player" style={{ '--fan-index': index }}>
                    <BallMark size={16} variant="onInk" />
                    <span>Players</span>
                  </div>
                ))}
                <div className="welcome-mini-card office coach" style={{ '--fan-index': 0 }}>Coach</div>
                <div className="welcome-mini-card office gm" style={{ '--fan-index': 1 }}>GM</div>
              </div>
            </>
          )}
          {step === 'players' && (
            <>
              <h1>The Players</h1>
              <p>Five starters and 2 bench players. Your starters directly contribute to your offensive and defensive output. Your bench players, a sixth man and a depth player, contribute in special ways that are unique to their cards.</p>
            </>
          )}
          {step === 'coachgm' && (
            <>
              <h1>The Coach and GM</h1>
              <p>Your Coach sets the gameplan and helps drive your franchise forward. Your GM helps negotiate better deals, spot young talent early or increase the size of your budget.</p>
            </>
          )}
          {step === 'ready' && (
            <h1>Utilize your entire hand and build a dynasty!</h1>
          )}
          <button type="button" className="primary welcome-continue" onClick={handleNext}>{isLast ? 'Deal My Hand' : step === 'welcome' ? 'Continue' : 'Next'}</button>
        </div>
      </section>
      {choosing && (
        <div className="welcome-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Learn more or start playing">
          <div className="welcome-dialog">
            <h2>Ready To Deal?</h2>
            <p>Want a closer look at how your cards work, or jump straight into the game?</p>
            <div className="welcome-dialog-actions">
              <button type="button" className="secondary" onClick={() => { setChoosing(false); onContinue(); }}>Learn More</button>
              <button type="button" className="primary" onClick={onStartPlaying}>Start Playing</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
