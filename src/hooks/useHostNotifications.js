import { useCallback, useEffect, useRef, useState } from 'react';

const ENABLED_KEY = 'nine-deep-host-notifications';

function supported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

async function notificationWorker() {
  return navigator.serviceWorker.register('/notifications/sw.js', { scope: '/notifications/' });
}

async function showNotification(title, body, roomCode) {
  const registration = await notificationWorker();
  await registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `nine-deep-${roomCode}-${title}-${body}`,
    data: { url: `/?room=${roomCode}` },
  });
}

function teamById(state, id) {
  return state.teams?.find((team) => team.id === Number(id));
}

export function useHostNotifications({ state, roomCode, myUid }) {
  const isHost = Boolean(state && state.hostUid === myUid);
  const previous = useRef(null);
  const [enabled, setEnabled] = useState(() => supported()
    && Notification.permission === 'granted'
    && localStorage.getItem(ENABLED_KEY) === '1');
  const permission = supported() ? Notification.permission : 'unsupported';

  const enable = useCallback(async () => {
    if (!supported()) return { ok: false, msg: 'Notifications are not supported in this browser.' };
    const result = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (result !== 'granted') {
      setEnabled(false);
      return { ok: false, msg: 'Notifications are blocked. Enable them in your browser settings and try again.' };
    }
    await notificationWorker();
    localStorage.setItem(ENABLED_KEY, '1');
    setEnabled(true);
    await showNotification('Nine Deep', 'Host notifications are enabled.', roomCode);
    return { ok: true };
  }, [roomCode]);

  useEffect(() => {
    if (!state || !isHost) { previous.current = state; return; }
    const prior = previous.current;
    previous.current = state;
    if (!prior || !enabled) return;

    const notices = [];
    (state.seats || []).forEach((seat, index) => {
      const oldSeat = prior.seats?.[index];
      if (seat.ownerUid && !oldSeat?.ownerUid && seat.ownerUid !== myUid) {
        notices.push(`${seat.name || 'A player'} joined room ${roomCode}.`);
      }
    });

    (state.teams || []).filter((team) => team.human && team.ownerUid !== myUid).forEach((team) => {
      const oldTeam = teamById(prior, team.id);
      if (team.lineupConfirmed && !oldTeam?.lineupConfirmed) notices.push(`${team.tricode} is ready to begin the season.`);
      if (state.offseason?.contractsFiled?.[team.id] && !prior.offseason?.contractsFiled?.[team.id]) {
        notices.push(`${team.tricode} is ready to begin the draft.`);
      }
    });

    const hostTeam = state.teams?.find((team) => team.ownerUid === myUid);
    (state.playoff?.matches || []).forEach((match, index) => {
      const oldMatch = prior.playoff?.matches?.[index];
      const participants = [match.a?.id, match.b?.id];
      if (!hostTeam || !participants.includes(hostTeam.id)) return;
      (match.readyTeamIds || []).filter((id) => !(oldMatch?.readyTeamIds || []).includes(id) && id !== hostTeam.id).forEach((id) => {
        const team = teamById(state, id);
        if (team?.human) notices.push(`${team.tricode} is ready for your playoff series.`);
      });
    });

    const oldBids = prior.offseason?.bidding || {};
    Object.entries(state.offseason?.bidding || {}).forEach(([cardId, session]) => {
      Object.entries(session.bids || {}).forEach(([teamId, bid]) => {
        const team = teamById(state, teamId);
        const oldBid = oldBids[cardId]?.bids?.[teamId];
        if (team?.human && team.ownerUid !== myUid && (!oldBid || oldBid.stage !== bid.stage)) {
          const card = state.freeAgents?.find((player) => String(player.id) === String(cardId));
          notices.push(`${team.tricode} made${oldBid ? ' an updated' : ' a'} free agency offer${card ? ` for ${card.grade} ${card.archetype} ${card.position}` : ''}.`);
        }
      });
    });

    notices.forEach((body) => showNotification('Nine Deep Host Alert', body, roomCode).catch(() => {}));
  }, [enabled, isHost, myUid, roomCode, state]);

  return { isHost, enabled, permission, enable };
}
