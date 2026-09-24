import { useEffect, useState } from 'react';
import BallMark from '../components/BallMark';
import { useDarkMode } from '../hooks/useDarkMode';

const MESSAGES = [
  'Constructing team…',
  'Calculating budget and projections…',
  'Applying league modifiers…',
];
const STEP_MS = 550;

// Fully automatic loading beat between the Matchup Cards step and Team Summary — no
// user input. Nothing about the roster is actually computed here (it's all already set by
// the time this phase is entered); this is purely a themed pause so the persistent bar,
// which stays empty through the whole Front Office / Hand / Matchup Cards sequence, doesn't
// just pop into existence — see GameShell.jsx's HIDE_BAR_PHASES.
export default function ConstructingScreen({ state, actions, myTeamId }) {
  const { darkMode } = useDarkMode();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= MESSAGES.length) {
      // Same reasoning as SimulatingSeasonScreen's own guard: every human client in a shared
      // room runs this local timer independently, but the phase flip only needs to happen
      // once — skip the redundant transaction once this client's own state shows another
      // client already got there.
      if (state.phase === 'constructing') actions.finishConstruction(myTeamId);
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
