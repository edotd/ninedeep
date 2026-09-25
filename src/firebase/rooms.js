import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, getDoc, limit, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './config';
import { INJURY_CHANCE, CHAMPIONSHIP_BAR_MULT, LEAGUE_TEAM_COUNT } from '../game/constants';
import { roomExpirationDate, roomHasExpired } from '../game/roomLifecycle';

export function ensureAuth() {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) { resolve(auth.currentUser); return; }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user); }
    }, reject);
    signInAnonymously(auth).catch(reject);
  });
}

// No 0/O/1/I — easy to read aloud or type from a friend's screen share.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

const ROOM_SEAT_COUNT = LEAGUE_TEAM_COUNT;

export async function createRoom() {
  const user = await ensureAuth();
  let code = randomRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(db, 'rooms', code));
    if (!existing.exists()) break;
    code = randomRoomCode();
  }
  const expiresAt = roomExpirationDate();
  await setDoc(doc(db, 'rooms', code), {
    hostUid: user.uid,
    createdAt: serverTimestamp(),
    expiresAt,
  });
  // Every room starts with the full league open. The host claims a seat in the lobby just
  // like every other player; any seats left open when the era begins become AI teams.
  const seats = Array.from({ length: ROOM_SEAT_COUNT }, (_, i) => ({
    seatIndex: i,
    name: '',
    ownerUid: null,
  }));
  await setDoc(doc(db, 'rooms', code, 'game', 'state'), {
    phase: 'lobby',
    hostUid: user.uid,
    expiresAt,
    seatCount: ROOM_SEAT_COUNT,
    seats,
    settings: {
      injuryChance: INJURY_CHANCE,
      championshipBarMult: CHAMPIONSHIP_BAR_MULT,
      actionLogSpeed: 'normal',
      winCondition: 'outright',
      matchupCardsEnabled: true,
      fanbaseCardsEnabled: false,
    },
  });
  return { code, uid: user.uid };
}

export async function joinRoom(code) {
  const user = await ensureAuth();
  const roomRef = doc(db, 'rooms', code);
  const stateRef = doc(db, 'rooms', code, 'game', 'state');
  const [roomSnap, snap] = await Promise.all([getDoc(roomRef), getDoc(stateRef)]);
  if (!roomSnap.exists() || !snap.exists() || roomHasExpired(roomSnap.data().expiresAt)) {
    throw new Error("Room not found — it may have expired after 72 hours.");
  }
  const expiresAt = roomExpirationDate();
  const batch = writeBatch(db);
  batch.set(roomRef, { expiresAt }, { merge: true });
  batch.set(stateRef, { expiresAt }, { merge: true });
  await batch.commit();
  return { uid: user.uid };
}

export async function deleteRoom(roomCode, uid) {
  await ensureAuth();
  const roomRef = doc(db, 'rooms', roomCode);
  const stateRef = doc(db, 'rooms', roomCode, 'game', 'state');
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) return;
    if (roomSnap.data().hostUid !== uid) throw new Error('Only the host can delete this room.');
    tx.delete(stateRef);
    tx.delete(roomRef);
  });
}

// Firestore TTL is the primary cleanup path. This sweep also removes expired rooms as soon
// as somebody next opens the app instead of waiting for Firestore's asynchronous TTL pass.
export async function cleanupExpiredRooms() {
  await ensureAuth();
  const expired = await getDocs(query(
    collection(db, 'rooms'),
    where('expiresAt', '<=', new Date()),
    limit(100),
  ));
  if (expired.empty) return 0;
  const batch = writeBatch(db);
  expired.docs.forEach((room) => {
    batch.delete(doc(db, 'rooms', room.id, 'game', 'state'));
    batch.delete(room.ref);
  });
  await batch.commit();
  return expired.size;
}
