import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { rehydrateState } from '../game/rehydrate';
import { roomExpirationDate, roomHasExpired } from '../game/roomLifecycle';

export function subscribeGameState(roomCode, onChange) {
  return onSnapshot(doc(db, 'rooms', roomCode, 'game', 'state'), (snap) => {
    if (!snap.exists()) { onChange(null); return; }
    const data = snap.data();
    rehydrateState(data);
    onChange(data);
  });
}

// Applies mutator(draft, ...args) to the room's current game doc inside a transaction, so
// two players acting at the same instant never clobber each other — Firestore retries the
// transaction against the latest server value if another write lands first.
export async function applyGameAction(roomCode, mutator, ...args) {
  const ref = doc(db, 'rooms', roomCode, 'game', 'state');
  const roomRef = doc(db, 'rooms', roomCode);
  return runTransaction(db, async (tx) => {
    const [roomSnap, snap] = await Promise.all([tx.get(roomRef), tx.get(ref)]);
    if (!roomSnap.exists() || !snap.exists() || roomHasExpired(roomSnap.data().expiresAt)) {
      throw new Error('This room has ended or expired.');
    }
    const draft = structuredClone(snap.data());
    rehydrateState(draft);
    const result = mutator(draft, ...args);
    const expiresAt = roomExpirationDate();
    tx.set(ref, { ...draft, expiresAt });
    tx.set(roomRef, { expiresAt }, { merge: true });
    return result;
  });
}
