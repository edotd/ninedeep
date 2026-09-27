import { useEffect, useState } from 'react';
import BallMark from './BallMark';

// Keep in lockstep with the 2.5s nd-splash-* keyframes in index.css.
const SPLASH_DURATION_MS = 2500;
const REDUCED_MOTION_DURATION_MS = 700;

// The era's opening splash — the ball mark assembling itself dot by dot, the wordmark and
// tagline holding, then moving the same lockup upward while the setup controls draw onto the
// same navy canvas. Click/tap during the intro skips directly to the setup state.
export default function SplashScreen({ children }) {
  const [setupVisible, setSetupVisible] = useState(false);
  // The click that mounts this screen (Start, in the same synchronous handler) is still
  // bubbling natively when React swaps the DOM in — without this guard, this overlay's own
  // onClick would catch that SAME click and skip itself before a single frame ever painted.
  // Deferred a tick (not just to next paint) so it lands safely after that dispatch finishes.
  const [canSkip, setCanSkip] = useState(false);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? REDUCED_MOTION_DURATION_MS : SPLASH_DURATION_MS;

  const finish = () => setSetupVisible(true);

  useEffect(() => {
    const skipTimer = setTimeout(() => setCanSkip(true), 400);
    const timer = setTimeout(finish, duration);
    return () => { clearTimeout(skipTimer); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={'nd-splash' + (setupVisible ? ' setup-visible' : '')} onClick={canSkip && !setupVisible ? finish : undefined} role="presentation">
      <div className="nd-splash-glow" aria-hidden="true" />
      <div className="nd-splash-body">
        <div className="nd-splash-ball">
          <BallMark size={96} variant="onInk" animateIn={!reducedMotion} />
          <div className="nd-splash-ring" aria-hidden="true" />
        </div>
        <div className="nd-splash-wordmark">
          <div className="nd-splash-lockup" aria-label="Nine Deep"><b>NINE</b> <i>DEEP</i></div>
          <div className="nd-splash-rule" aria-hidden="true" />
          <div className="nd-splash-tagline">Nine Cards. Nine Seasons.</div>
        </div>
      </div>
      {!setupVisible && <div className="nd-splash-skip">Tap to skip</div>}
      <div className="nd-splash-setup" aria-hidden={!setupVisible}>{setupVisible && children}</div>
    </div>
  );
}
