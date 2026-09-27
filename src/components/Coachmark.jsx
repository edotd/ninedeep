import { useEffect, useState } from 'react';

// A single anchored onboarding step: dims the whole screen except a cutout around
// `targetRef`'s real, currently-rendered element, with a small callout near it. Re-measures on
// resize/scroll and whenever the target itself resizes (a ResizeObserver, not just window
// resize — the target can change size on its own, e.g. a tab's alert-badge appearing) so the
// cutout tracks a moving/reflowing target rather than freezing at its first-render position.
export default function Coachmark({ targetRef, title, body, step, total, onNext, onDismiss, lastLabel = 'Got It' }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const measure = () => {
      const el = targetRef.current;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    // The target may not have painted yet on the same frame this effect runs (e.g. a tab
    // just switched into view) — one rAF catch-up covers that without polling indefinitely.
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const observer = new ResizeObserver(measure);
    if (targetRef.current) observer.observe(targetRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer.disconnect();
    };
  }, [targetRef, step]);

  if (!rect) return null;

  const pad = 6;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotHeight = rect.height + pad * 2;
  const spaceBelow = window.innerHeight - (spotTop + spotHeight);
  const placeAbove = spaceBelow < 170 && spotTop > 170;

  return (
    <div className="coachmark-layer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="coachmark-spotlight" style={{ top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight }} />
      <div
        className="coachmark-tooltip"
        style={placeAbove ? { bottom: window.innerHeight - spotTop + 12 } : { top: spotTop + spotHeight + 12 }}
      >
        {total > 1 && <div className="coachmark-step">{step} / {total}</div>}
        <h4>{title}</h4>
        <p>{body}</p>
        <div className="coachmark-actions">
          <button type="button" className="coachmark-skip" onClick={onDismiss}>Skip</button>
          <button type="button" className="coachmark-next primary" onClick={onNext}>{step === total ? lastLabel : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
