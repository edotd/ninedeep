import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { INJURY_CHANCE, CHAMPIONSHIP_BAR_MULT, LEAGUE_TEAM_COUNT } from '../game/constants';

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
  await setDoc(doc(db, 'rooms', code), {
    hostUid: user.uid,
    createdAt: serverTimestamp(),
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
    seatCount: ROOM_SEAT_COUNT,
    seats,
    settings: {
      injuryChance: INJURY_CHANCE,
      championshipBarMult: CHAMPIONSHIP_BAR_MULT,
      actionLogSpeed: 'normal',
      winCondition: 'outright',
      matchupCardsEnabled: true,
      fanbaseCardsEnabled: true,
    },
  });
  return { code, uid: user.uid };
}

export async function joinRoom(code) {
  const user = await ensureAuth();
  const snap = await getDoc(doc(db, 'rooms', code, 'game', 'state'));
  if (!snap.exists()) throw new Error("Room not found — double-check the code.");
  return { uid: user.uid };
}
