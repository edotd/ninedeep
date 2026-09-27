import { useEffect, useState } from 'react';
import BallMark from './BallMark';

// Keep in lockstep with every `3.6s` in index.css's nd-splash-* keyframes — there's no single
// shared constant between CSS and JS, so a change to the animation's length has to be made in
// both places together. Total including the 350ms exit fade must stay under 4s.
const SPLASH_DURATION_MS = 3600;
const REDUCED_MOTION_DURATION_MS = 700;

// The era's opening splash — the ball mark assembling itself dot by dot, the wordmark and
// tagline holding, then fading back down to just the mark before the real deal begins
// underneath. Plays once per era (see GameShell, which gates this on state.eraId + localStorage
// so a reload or returning later doesn't replay it). Click/tap anywhere skips straight to done.
export default function SplashScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false);
  // The click that mounts this screen (Start, in the same synchronous handler) is still
  // bubbling natively when React swaps the DOM in — without this guard, this overlay's own
  // onClick would catch that SAME click and skip itself before a single frame ever painted.
  // Deferred a tick (not just to next paint) so it lands safely after that dispatch finishes.
  const [canSkip, setCanSkip] = useState(false);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? REDUCED_MOTION_DURATION_MS : SPLASH_DURATION_MS;

  const finish = () => {
    setExiting(true);
    setTimeout(onComplete, 350);
  };

  useEffect(() => {
    const skipTimer = setTimeout(() => setCanSkip(true), 400);
    const timer = setTimeout(finish, duration);
    return () => { clearTimeout(skipTimer); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={'nd-splash' + (exiting ? ' exiting' : '')} onClick={canSkip && !exiting ? finish : undefined} role="presentation">
      <div className="nd-splash-glow" aria-hidden="true" />
      <div className="nd-splash-body">
        <div className="nd-splash-ball">
          <BallMark size={96} variant="onInk" animateIn={!reducedMotion} />
          <div className="nd-splash-ring" aria-hidden="true" />
        </div>
        <div className="nd-splash-wordmark">
          <div className="nd-splash-lockup" aria-label="Nine Deep"><b>NINE</b> <i>DEEP</i></div>
          <div className="nd-splash-rule" aria-hidden="true" />
          <div className="nd-splash-tagline">Nine Men. Eight Years.</div>
        </div>
      </div>
      <div className="nd-splash-skip">Tap to skip</div>
    </div>
  );
}
