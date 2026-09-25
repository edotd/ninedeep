import { useEffect } from 'react';
import BallMark from '../components/BallMark';
import { useDarkMode } from '../hooks/useDarkMode';

export default function DraftTransitionScreen({ state, actions, myTeamId }) {
  const { darkMode } = useDarkMode();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (state.phase === 'drafttransition') actions.finishDraftTransition(myTeamId);
    }, 2000);
    return () => window.clearTimeout(timer);
    // The shared phase is the guard against multiple room clients completing this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen constructing-screen">
      <BallMark size={72} variant={darkMode ? 'onInk' : 'onFile'} spinning />
      <div className="constructing-message">
        <span className="constructing-message-in">Loading Season {state.season}</span>
      </div>
    </div>
  );
}
