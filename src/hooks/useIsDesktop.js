import { useEffect, useState } from 'react';

// The breakpoint at which the app switches from the phone-width single-column layout to the
// desktop shell (sidebar + wide content pane + full-width persistent bar) from the brand
// handoff. Kept in sync with the `@media (min-width: 1000px)` rules in index.css that adjust
// shared classes (.bottombar, etc.) the two shells both use.
const DESKTOP_BREAKPOINT = 1000;

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
