import { useEffect, useRef, useState } from 'react';
import Coachmark from './Coachmark';
import { useOnboardingMode } from '../hooks/useOnboardingMode';

// A short anchored onboarding sequence, each step a real ref the caller supplies
// (`steps: [{ targetRef, title, body }]`). Behavior depends on the device-level Settings choice
// (useOnboardingMode): 'off' never shows anything; 'first' shows once ever per `storageKey`
// (the original behavior); 'always' replays the whole tour every time `active` next becomes
// true (e.g. navigating back to this screen), ignoring whether it's ever been dismissed before.
export default function CoachmarkTour({ steps, storageKey, active = true }) {
  const { mode } = useOnboardingMode();
  const [index, setIndex] = useState(0);
  const [hiddenThisVisit, setHiddenThisVisit] = useState(false);
  const wasActiveRef = useRef(active);

  // A fresh activation (this tour's `active` condition just turned true) restarts the tour and
  // clears any earlier-this-visit dismissal — the only way 'always' mode actually replays on
  // each visit instead of just staying hidden forever after its first dismiss.
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      setIndex(0);
      setHiddenThisVisit(false);
    }
    wasActiveRef.current = active;
  }, [active]);

  if (mode === 'off' || !active || hiddenThisVisit || !steps.length) return null;

  if (mode === 'first') {
    let seenEver = true;
    try { seenEver = localStorage.getItem(storageKey) === '1'; } catch { seenEver = true; }
    if (seenEver) return null;
  }

  const current = steps[index];
  if (!current?.targetRef) return null;

  const finish = () => {
    setHiddenThisVisit(true);
    if (mode === 'first') {
      try { localStorage.setItem(storageKey, '1'); } catch { /* storage can be unavailable */ }
    }
  };

  return (
    <Coachmark
      targetRef={current.targetRef}
      title={current.title}
      body={current.body}
      step={index + 1}
      total={steps.length}
      onDismiss={finish}
      onNext={() => (index + 1 < steps.length ? setIndex((i) => i + 1) : finish())}
    />
  );
}
