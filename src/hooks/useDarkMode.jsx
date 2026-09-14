import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'nine-deep-dark-mode';

// A device-level display preference, not a game setting — it lives in localStorage rather
// than state.settings so it doesn't sync across an online room's players (everyone should be
// free to pick their own) and so it applies even before a game/room exists (Landing/Setup).
const DarkModeContext = createContext(null);

export function DarkModeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY, darkMode ? '1' : '0'); } catch { /* ignore */ }
  }, [darkMode]);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const ctx = useContext(DarkModeContext);
  if (!ctx) throw new Error('useDarkMode must be used inside a DarkModeProvider');
  return ctx;
}
