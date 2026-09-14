import { useEffect, useState } from 'react';
import { createRoom, joinRoom } from '../firebase/rooms';
import { firebaseReady } from '../firebase/config';
import BallMark from '../components/BallMark';
import { useDarkMode } from '../hooks/useDarkMode';

export default function LandingScreen({ pendingJoinCode, onSolo, onEnterRoom }) {
  const { darkMode } = useDarkMode();
  const [tab, setTab] = useState(pendingJoinCode ? 'join' : 'host');
  const [hostName, setHostName] = useState('');
  const [seatCount, setSeatCount] = useState(4);
  const [joinCode, setJoinCode] = useState(pendingJoinCode || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // pendingJoinCode arrives from a URL query param, which App.jsx only reads after the
  // initial render (inside an effect) — so it can still be empty on this component's first
  // render. Sync tab/joinCode once it actually shows up, instead of only seeding useState's
  // one-time initial value.
  useEffect(() => {
    if (pendingJoinCode) {
      setTab('join');
      setJoinCode(pendingJoinCode);
    }
  }, [pendingJoinCode]);

  const handleCreate = async () => {
    setError('');
    setBusy(true);
    try {
      const { code, uid } = await createRoom({ hostName: hostName.trim(), seatCount });
      onEnterRoom(code, uid);
    } catch (e) {
      setError(e.message || 'Could not create room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const { uid } = await joinRoom(code);
      onEnterRoom(code, uid);
    } catch (e) {
      setError(e.message || 'Could not join room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <BallMark size={56} variant={darkMode ? 'onInk' : 'onFile'} />
        <h1 style={{ margin: 0, fontSize: 52 }}><span className="wordmark-ink">NINE</span> <span style={{ color: 'var(--stamp)' }}>DEEP</span></h1>
      </div>
      <p className="lede">Play solo against AI ownership groups, or start an online room and play an era with friends.</p>

      <button className="secondary" style={{ width: '100%', marginBottom: 18 }} onClick={onSolo}>Play Solo</button>

      {!firebaseReady ? (
        <div className="statusline bad">Online play isn't configured yet for this deployment.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className={tab === 'host' ? 'primary' : 'secondary'} style={{ flex: 1 }} onClick={() => setTab('host')}>Host a Room</button>
            <button className={tab === 'join' ? 'primary' : 'secondary'} style={{ flex: 1 }} onClick={() => setTab('join')}>Join a Room</button>
          </div>

          {tab === 'host' && (
            <div className="pull-slot">
              <div className="pull-label">Your Name</div>
              <input className="text-input" style={{ marginBottom: 10 }} value={hostName} onChange={(e) => setHostName(e.target.value)} maxLength={32} placeholder="e.g. Sam" />
              <div className="pull-label">Human Seats (2–10, rest fill with AI)</div>
              <input
                className="text-input"
                style={{ marginBottom: 10 }}
                type="number"
                min="2"
                max="10"
                value={seatCount}
                onChange={(e) => setSeatCount(Math.max(2, Math.min(10, Number(e.target.value) || 2)))}
              />
              <button className="primary" style={{ width: '100%' }} disabled={busy} onClick={handleCreate}>
                {busy ? 'Creating…' : 'Create Room'}
              </button>
            </div>
          )}

          {tab === 'join' && (
            <div className="pull-slot">
              <div className="pull-label">Room Code</div>
              <input
                className="text-input"
                style={{ marginBottom: 10, textTransform: 'uppercase' }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={5}
                placeholder="e.g. X7K2P"
              />
              <button className="primary" style={{ width: '100%' }} disabled={busy || !joinCode.trim()} onClick={handleJoin}>
                {busy ? 'Joining…' : 'Join Room'}
              </button>
            </div>
          )}

          {error && <div className="statusline bad" style={{ marginTop: 10 }}>{error}</div>}
        </>
      )}
    </div>
  );
}
