import BallMark from '../components/BallMark';
import './WelcomeScreen.css';

const STEPS = ['welcome', 'cards', 'players', 'coachgm', 'ready'];

export default function WelcomeScreen({ teamName, onContinue, step = 'welcome' }) {
  const isLast = step === STEPS[STEPS.length - 1];
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
              <p>At the start of the game each player receives nine cards.</p>
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
          <button type="button" className="primary welcome-continue" onClick={onContinue}>{isLast ? 'Deal My Hand' : step === 'welcome' ? 'Continue' : 'Next'}</button>
        </div>
      </section>
    </main>
  );
}
