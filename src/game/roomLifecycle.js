export const ROOM_LIFETIME_MS = 72 * 60 * 60 * 1000;

export function roomExpirationDate(now = Date.now()) {
  return new Date(now + ROOM_LIFETIME_MS);
}

export function roomHasExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return false;
  const expirationMs = typeof expiresAt.toMillis === 'function'
    ? expiresAt.toMillis()
    : new Date(expiresAt).getTime();
  return Number.isFinite(expirationMs) && expirationMs <= now;
}
