import { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'nine-deep-onboarding-mode';
export const ONBOARDING_MODES = ['off', 'always', 'first'];
const DEFAULT_MODE = 'first';

// A device-level display preference, not a game setting — same reasoning as useDarkMode (lives
// in localStorage, not state.settings, so it doesn't sync across an online room's players).
// 'off' never shows a coachmark tour. 'always' replays every tour every time its `active`
// condition next becomes true (e.g. navigating back to a screen), ignoring whether it's ever
// been dismissed before. 'first' (the default) is the original behavior — each tour shows once
// ever, gated by its own storageKey.
const OnboardingModeContext = createContext(null);

export function OnboardingModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return ONBOARDING_MODES.includes(stored) ? stored : DEFAULT_MODE;
    } catch { return DEFAULT_MODE; }
  });

  const updateMode = (next) => {
    setMode(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage can be unavailable */ }
  };

  return (
    <OnboardingModeContext.Provider value={{ mode, setMode: updateMode }}>
      {children}
    </OnboardingModeContext.Provider>
  );
}

export function useOnboardingMode() {
  const ctx = useContext(OnboardingModeContext);
  if (!ctx) throw new Error('useOnboardingMode must be used inside an OnboardingModeProvider');
  return ctx;
}
