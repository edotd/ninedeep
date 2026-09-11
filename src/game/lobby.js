// Room-lobby mutators — these operate on the pre-game "lobby" shape of the shared doc
// (phase: 'lobby', seats: [...]) rather than the full in-era game state, so they live
// outside game/actionMap.js (which is shared with solo mode, which has no lobby at all).
import { AI_NAMES } from './constants';
import { buildStarPool, buildTeams, initFrontOffice } from './season';

export function claimSeat(state, seatIndex, uid, name) {
  const seat = state.seats[seatIndex];
  if (!seat) return;
  if (seat.ownerUid && seat.ownerUid !== uid) return; // already taken by someone else
  seat.ownerUid = uid;
  seat.name = (name || '').trim().slice(0, 32) || `Player ${seatIndex + 1}`;
}

export function leaveSeat(state, seatIndex, uid) {
  const seat = state.seats[seatIndex];
  if (!seat || seat.ownerUid !== uid) return;
  seat.ownerUid = null;
  seat.name = '';
}

function teamSeatsFromLobby(seats) {
  const humanSeats = seats.filter((s) => s.ownerUid).map((s) => ({ name: s.name, human: true, ownerUid: s.ownerUid }));
  const aiNeeded = Math.max(0, 10 - humanSeats.length);
  const aiSeats = AI_NAMES.slice(0, aiNeeded).map((n) => ({ name: n, human: false }));
  return [...humanSeats, ...aiSeats];
}

export function startEraOnline(state, hostUid) {
  if (state.hostUid !== hostUid) return; // only the host can start the era
  if (!state.seats.some((s) => s.ownerUid)) return; // need at least one claimed seat
  const seats = teamSeatsFromLobby(state.seats);
  buildStarPool(state);
  buildTeams(state, seats);
  initFrontOffice(state);
}

// "New Era" for an online room: back to the lobby, keeping whoever already claimed a seat
// (by uid/name) so the group doesn't have to re-claim to play again.
export function resetRoomToLobby(state, hostUid) {
  if (state.hostUid !== hostUid) return;
  const priorHumanTeams = (state.teams || []).filter((t) => t.human);
  const seatCount = state.seatCount || (state.teams ? state.teams.length : 10);
  const seats = Array.from({ length: seatCount }, (_, i) => {
    const prior = priorHumanTeams[i];
    return prior ? { seatIndex: i, ownerUid: prior.ownerUid, name: prior.name } : { seatIndex: i, ownerUid: null, name: '' };
  });
  const keepHostUid = state.hostUid;
  const keepSettings = state.settings;
  Object.keys(state).forEach((k) => { delete state[k]; });
  state.phase = 'lobby';
  state.hostUid = keepHostUid;
  state.seatCount = seatCount;
  state.seats = seats;
  state.settings = keepSettings;
}
