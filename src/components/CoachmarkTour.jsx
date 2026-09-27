import { useState } from 'react';
import Coachmark from './Coachmark';

// Shown once per browser, gated by `storageKey` — a single step or a short sequence, each
// anchored to a real ref the caller supplies (`steps: [{ targetRef, title, body }]`). `active`
// lets the caller decide the tour is even relevant right now (e.g. only before a lineup has
// ever been set) without that decision affecting the seen/not-seen flag itself.
export default function CoachmarkTour({ steps, storageKey, active = true }) {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return true; }
  });
  const [index, setIndex] = useState(0);

  const finish = () => {
    setSeen(true);
    try { localStorage.setItem(storageKey, '1'); } catch { /* storage can be unavailable */ }
  };

  if (seen || !active || !steps.length) return null;
  const current = steps[index];
  if (!current?.targetRef) return null;

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
