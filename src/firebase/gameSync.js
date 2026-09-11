import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { rehydrateState } from '../game/rehydrate';

export function subscribeGameState(roomCode, onChange) {
  return onSnapshot(doc(db, 'rooms', roomCode, 'game', 'state'), (snap) => {
    if (!snap.exists()) return;
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
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const draft = structuredClone(snap.data());
    rehydrateState(draft);
    const result = mutator(draft, ...args);
    tx.set(ref, draft);
    return result;
  });
}
