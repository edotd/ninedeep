import { useEffect, useState } from 'react';
import { createRoom, joinRoom } from '../firebase/rooms';
import { firebaseReady } from '../firebase/config';
import BallMark from '../components/BallMark';
import SettingsScreen from './SettingsScreen';
import { randomFranchiseName } from '../game/names';

// A compact branded setup screen. Solo keeps only the franchise name and Start action here;
// all configuration lives on the linked Settings screen.
export default function EntryScreen({ pendingJoinCode, joinOnly = false, soloState, soloActions, onStartSolo, onEnterRoom }) {
  const [tab, setTab] = useState(pendingJoinCode ? 'join' : 'solo');
  const [overlay, setOverlay] = useState(null); // null | 'settings'

  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState(pendingJoinCode || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep the join form aligned if a room invitation changes without remounting this screen.
  useEffect(() => {
    if (pendingJoinCode) {
      setTab('join');
      setJoinCode(pendingJoinCode);
    }
  }, [pendingJoinCode]);

  if (overlay === 'settings') return <SettingsScreen state={soloState} actions={soloActions} onBack={() => setOverlay(null)} />;


  const handleStartSolo = () => {
    if (!teamName.trim()) return;
    soloActions.startEra(teamName);
    onStartSolo();
  };

  const handleCreate = async () => {
    setError('');
    setBusy(true);
    try {
      const { code, uid } = await createRoom();
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
    <div className="entry-screen">
      <div className="entry-shell">
        <div className="entry-brand">
          <div className="entry-lockup">
            <BallMark size={40} variant="onInk" />
            <span className="entry-wordmark"><b>NINE</b> <i>DEEP</i></span>
          </div>
        </div>

        <div className="entry-panel">
          {joinOnly
            ? <div className="entry-join-heading"><span>Invitation</span><strong>Join Room</strong></div>
            : (
              <div className="entry-tabs">
                <button className={'entry-tab' + (tab === 'solo' ? ' active' : '')} onClick={() => setTab('solo')}>Solo</button>
                <button className={'entry-tab' + (tab === 'host' ? ' active' : '')} onClick={() => setTab('host')} disabled={!firebaseReady}>Host</button>
                <button className={'entry-tab' + (tab === 'join' ? ' active' : '')} onClick={() => setTab('join')} disabled={!firebaseReady}>Join</button>
              </div>
            )}

          {!firebaseReady && tab !== 'solo' && (
            <div className="statusline bad">Online play isn't configured yet for this deployment.</div>
          )}

          {!joinOnly && tab === 'solo' && (
            <>
              <div className="entry-version">v1.18</div>
              <div className="entry-field-group">
                <div className="entry-field-heading">
                  <span>Franchise Name</span>
                  <span className="entry-required">Required To Start</span>
                </div>
                <div className="entry-name-box">
                  <input
                    className="entry-name-input"
                    type="text"
                    maxLength={32}
                    placeholder="e.g. Riverside Ironclads"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <div className="entry-name-footer">
                    <button className="entry-generate" onClick={() => setTeamName(randomFranchiseName())}>
                      <BallMark size={16} variant="onInk" /> Generate One
                    </button>
                  </div>
                </div>
              </div>

              <div className="entry-start-block compact">
                <button className="entry-start-btn" disabled={!teamName.trim()} onClick={handleStartSolo}>
                  Start <span>→</span>
                </button>
                <button className="entry-more-settings" onClick={() => setOverlay('settings')}>
                  Settings
                </button>
              </div>
            </>
          )}

          {!joinOnly && tab === 'host' && firebaseReady && (
            <div className="entry-start-block" style={{ marginTop: 0 }}>
              <button className="entry-start-btn" disabled={busy} onClick={handleCreate}>
                {busy ? 'Creating…' : 'Create Room'} <span>→</span>
              </button>
              {error && <div className="statusline bad">{error}</div>}
            </div>
          )}

          {tab === 'join' && firebaseReady && (
            <div className="entry-start-block" style={{ marginTop: 0 }}>
              <div className="entry-field-group">
                <div className="entry-field-heading"><span>Room Code</span></div>
                <input
                  className="text-input"
                  style={{ textTransform: 'uppercase' }}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={5}
                  placeholder="e.g. X7K2P"
                />
              </div>
              <button className="entry-start-btn" disabled={busy || !joinCode.trim()} onClick={handleJoin}>
                {busy ? 'Joining…' : 'Join Room'} <span>→</span>
              </button>
              {error && <div className="statusline bad">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
