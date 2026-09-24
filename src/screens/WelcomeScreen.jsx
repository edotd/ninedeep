import BallMark from '../components/BallMark';
import './WelcomeScreen.css';

export default function WelcomeScreen({ onContinue }) {
  return (
    <main className="welcome-screen">
      <section className="welcome-file">
        <div className="welcome-lockup" aria-label="Nine Deep">
          <BallMark size={54} variant="onInk" />
          <span><b>NINE</b> <i>DEEP</i></span>
        </div>
        <div className="welcome-copy">
          <h1>Welcome to Nine Deep.</h1>
          <p>Use player, coach and supplemental cards to build a cohesive unit and compete for championships. The player with the most championships at the end of the era wins the game.</p>
          <button type="button" className="primary welcome-continue" onClick={onContinue}>Continue</button>
        </div>
      </section>
    </main>
  );
}
