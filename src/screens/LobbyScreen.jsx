import { useState } from 'react';
import EraSettingsFields from '../components/EraSettingsFields';
import { randomFranchiseName } from '../game/names';

export default function LobbyScreen({ state, actions, roomCode, myUid, onExit, actionError }) {
  const [seatNames, setSeatNames] = useState({});
  const isHost = state.hostUid === myUid;
  const claimedCount = state.seats.filter((s) => s.ownerUid).length;
  const link = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${roomCode}` : '';

  return (
    <div className="screen">
      {onExit && <button className="reset-link" style={{ marginBottom: 12 }} onClick={onExit}>← Leave</button>}
      {actionError && <div className="statusline bad" style={{ marginBottom: 12 }}>{actionError}</div>}
      <h1>Lobby</h1>
      <div className="pull-slot">
        <div className="pull-label">Room Code — share this link with friends</div>
        <div className="pull-value" style={{ fontSize: 26, letterSpacing: 2 }}>{roomCode}</div>
        <div className="pull-extra" style={{ wordBreak: 'break-all' }}>{link}</div>
      </div>

      <h2>Seats ({claimedCount}/{state.seatCount} claimed)</h2>
      {state.seats.map((seat) => {
        const seatName = seatNames[seat.seatIndex] || '';
        const setSeatName = (name) => setSeatNames((current) => ({ ...current, [seat.seatIndex]: name }));
        return (
          <div key={seat.seatIndex} className={'standing-row lobby-seat-row' + (seat.ownerUid === myUid ? ' you' : '')}>
            <span>{seat.ownerUid ? seat.name : 'Open seat'}{seat.ownerUid === myUid ? ' (you)' : ''}</span>
            {!seat.ownerUid && (
              <div className="lobby-claim-controls">
                <input
                  className="text-input lobby-name-input"
                  value={seatName}
                  onChange={(event) => setSeatName(event.target.value)}
                  maxLength={32}
                  placeholder="Franchise name"
                  aria-label={`Franchise name for seat ${seat.seatIndex + 1}`}
                />
                <button
                  className="lobby-randomize-name"
                  onClick={() => setSeatName(randomFranchiseName())}
                  aria-label={`Choose a random franchise name for seat ${seat.seatIndex + 1}`}
                  title="Choose a random franchise name"
                >🎲</button>
                <button className="secondary" disabled={!seatName.trim()} onClick={() => actions.claimSeat(seat.seatIndex, myUid, seatName)}>Claim</button>
              </div>
            )}
            {seat.ownerUid === myUid && (
              <button className="reset-link" onClick={() => actions.leaveSeat(seat.seatIndex, myUid)}>Leave seat</button>
            )}
          </div>
        );
      })}

      {isHost ? (
        <>
          <h2>Era Setup</h2>
          <EraSettingsFields settings={state.settings} actions={actions} />
          <button
            className="primary"
            style={{ width: '100%', padding: 16, marginTop: 16 }}
            disabled={claimedCount === 0}
            onClick={() => actions.startEraOnline(myUid)}
          >
            Start Era ({claimedCount} human{claimedCount === 1 ? '' : 's'}, {state.seatCount - claimedCount} AI)
          </button>
        </>
      ) : (
        <p className="lede" style={{ marginTop: 16 }}>Waiting for the host to start the game…</p>
      )}
    </div>
  );
}
