import { useEffect, useState } from 'react';
import BallMark from '../components/BallMark';
import { useDarkMode } from '../hooks/useDarkMode';

const MESSAGES = [
  'Simulating the regular season…',
  'Calculating final standings…',
  'Setting playoff seeding…',
];
const STEP_MS = 550;

// Loading beat between locking in your lineup and the Standings screen — same auto-advancing
// pattern as ConstructingScreen. The actual seeding/cap-lock work already ran synchronously
// in lockSeasonAndSeed (see confirmLineup in engine.js); this is just a themed pause before
// the results appear.
export default function SimulatingSeasonScreen({ state, actions, myTeamId }) {
  const { darkMode } = useDarkMode();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= MESSAGES.length) {
      // In a shared room, every human client runs this same local timer independently — the
      // phase flip only actually needs to happen once. Skipping it here when this client's own
      // already-synced state shows another client got there first avoids a same-document
      // Firestore transaction racing (and retrying under contention) across everyone's clients
      // at once; this client's own screen still advances normally once that write reaches it.
      if (state.phase === 'simulating') actions.finishSeasonSimulation(myTeamId);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="screen constructing-screen">
      <BallMark size={72} variant={darkMode ? 'onInk' : 'onFile'} spinning />
      <div className="constructing-message" key={Math.min(step, MESSAGES.length - 1)}>
        <span className="constructing-message-in">{MESSAGES[Math.min(step, MESSAGES.length - 1)]}</span>
      </div>
    </div>
  );
}
