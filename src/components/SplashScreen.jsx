import { useEffect, useState } from 'react';
import BallMark from './BallMark';
import { CONTACT_LINK } from '../config/links';

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
      {setupVisible && <div className="nd-splash-spacer" aria-hidden="true" />}
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
      {setupVisible && (
        <nav className="nd-splash-footer" aria-label="Social links and contact">
          <span className="social disabled" role="img" aria-disabled="true" aria-label="Twitter (coming soon)" title="Coming soon">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </span>
          <span className="social disabled" role="img" aria-disabled="true" aria-label="Instagram (coming soon)" title="Coming soon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>
          </span>
          <span className="social disabled" role="img" aria-disabled="true" aria-label="TikTok (coming soon)" title="Coming soon">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 2.59-2.59c.27 0 .53.04.77.12V9.66a5.7 5.7 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" /></svg>
          </span>
          <span className="nd-splash-footer-rule" aria-hidden="true" />
          <a className="contact" href={CONTACT_LINK}>Contact</a>
        </nav>
      )}
    </div>
  );
}
