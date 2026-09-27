import BallMark from '../components/BallMark';
import './WelcomeScreen.css';

export default function WelcomeScreen({ teamName, onContinue }) {
  return (
    <main className="welcome-screen">
      <section className="welcome-file">
        <div className="welcome-lockup" aria-label="Nine Deep">
          <BallMark size={54} variant="onInk" />
        </div>
        <div className="welcome-copy">
          <h1>Welcome to Nine Deep!</h1>
          <p>You've been handed the keys to {teamName} and given one directive: build a powerhouse and win championships. You'll be competing with eight other teams who're constructed in completely different ways.</p>
          <button type="button" className="primary welcome-continue" onClick={onContinue}>Continue</button>
        </div>
      </section>
    </main>
  );
}
