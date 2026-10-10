// A tiny registry so a screen with unsaved work (the lineup page) can intercept navigation
// that unmounts it. The screen registers a guard while it has unsaved changes; navigation
// points call guardedNavigate(go) instead of go() directly. With no guard it runs go() at once.
let guard = null;

export function setLeaveGuard(next) {
  guard = next;
  return () => { if (guard === next) guard = null; };
}

export function guardedNavigate(go) {
  if (guard) guard(go);
  else go();
}
