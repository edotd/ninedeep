import BallMark from '../components/BallMark';
import './WelcomeScreen.css';

export default function WelcomeScreen({ teamName, onContinue, cards = false }) {
  return (
    <main className="welcome-screen">
      <section className="welcome-file">
        <div className="welcome-lockup" aria-label="Nine Deep">
          <BallMark size={54} variant="onInk" />
        </div>
        <div className="welcome-copy">
          {cards ? (
            <>
              <h1>The Cards</h1>
              <p>At the start of the game each player receives nine cards.</p>
              <div className="welcome-card-fan" aria-label="Seven player cards, one coach card, and one general manager card">
                {Array.from({ length: 7 }, (_, index) => <div key={index} className="welcome-mini-card player" style={{ '--fan-index': index }}><BallMark size={18} variant="onInk" /></div>)}
                <div className="welcome-mini-card office coach" style={{ '--fan-index': 0 }}>Coach</div>
                <div className="welcome-mini-card office gm" style={{ '--fan-index': 1 }}>GM</div>
              </div>
              <button type="button" className="primary welcome-continue" onClick={onContinue}>Deal My Hand</button>
            </>
          ) : (
            <>
              <h1>How It Works</h1>
              <p>You've been handed the keys to <strong className="welcome-franchise-name">{teamName}</strong> and given one directive: win championships. Eight other franchises have the same goal - can you outlast the competition and cement your place in the history books?</p>
              <button type="button" className="primary welcome-continue" onClick={onContinue}>Continue</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
