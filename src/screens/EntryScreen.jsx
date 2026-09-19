import { useEffect, useState } from 'react';
import { createRoom, joinRoom } from '../firebase/rooms';
import { firebaseReady } from '../firebase/config';
import BallMark from '../components/BallMark';
import GlossaryScreen from './GlossaryScreen';
import SettingsScreen from './SettingsScreen';
import { randomFranchiseName } from '../game/names';

// The Entry screen — "1B · The Marquee" from the design brand handoff's Nine Deep Entry
// file. Replaces the old two-step flow (a mode-picker LandingScreen, then a separate
// SetupScreen for naming the solo franchise) with one screen: an ink hero half that carries
// the pitch and a browsable glossary preview, and a cream setup half on the right whose
// content swaps with the Solo/Host/Join tab. Solo keeps only the franchise name and Start
// action here; all configuration lives on the linked Settings screen.
export default function EntryScreen({ pendingJoinCode, soloState, soloActions, onStartSolo, onEnterRoom }) {
  const [tab, setTab] = useState(pendingJoinCode ? 'join' : 'solo');
  const [overlay, setOverlay] = useState(null); // null | 'glossary' | 'settings'

  const [teamName, setTeamName] = useState('');
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

  if (overlay === 'glossary') return <GlossaryScreen state={soloState} onBack={() => setOverlay(null)} />;
  if (overlay === 'settings') return <SettingsScreen state={soloState} actions={soloActions} onBack={() => setOverlay(null)} />;


  const handleStartSolo = () => {
    soloActions.startEra(teamName);
    onStartSolo();
  };

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
    <div className="entry-screen">
      <div className="entry-shell">
        <div className="entry-marquee">
          <div className="entry-marquee-dots" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <div key={i} className="entry-marquee-dot" />)}
          </div>

          <div className="entry-lockup">
            <BallMark size={40} variant="onInk" />
            <span className="entry-wordmark"><b>NINE</b> <i>DEEP</i></span>
          </div>

          <h1 className="entry-headline">Eight seasons.<br />Nine cards<br />a season.</h1>
          <div className="entry-glossary">
            <div className="entry-glossary-tabs"><div className="entry-glossary-tab active">How To Play</div></div>
            <div className="entry-glossary-rows">
              <div className="entry-glossary-row">
                <div className="entry-glossary-row-text">Each turn is a full season: regular season, playoffs, and the draft. Player, Front Office, and Matchup cards are dealt to each player at random. Assemble a cohesive unit and end the era with the most titles to claim victory.</div>
              </div>
            </div>
            <button className="entry-glossary-link" onClick={() => setOverlay('glossary')}>
              Open The Full Glossary <span>→</span>
            </button>
          </div>
        </div>

        <div className="entry-panel">
          <div className="entry-tabs">
            <button className={'entry-tab' + (tab === 'solo' ? ' active' : '')} onClick={() => setTab('solo')}>Solo</button>
            <button className={'entry-tab' + (tab === 'host' ? ' active' : '')} onClick={() => setTab('host')} disabled={!firebaseReady}>Host</button>
            <button className={'entry-tab' + (tab === 'join' ? ' active' : '')} onClick={() => setTab('join')} disabled={!firebaseReady}>Join</button>
          </div>

          {!firebaseReady && tab !== 'solo' && (
            <div className="statusline bad">Online play isn't configured yet for this deployment.</div>
          )}

          {tab === 'solo' && (
            <>
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
                    <span>Locked in for all eight seasons.</span>
                    <button className="entry-generate" onClick={() => setTeamName(randomFranchiseName())}>
                      <BallMark size={16} variant="onInk" /> Generate One
                    </button>
                  </div>
                </div>
              </div>

              <div className="entry-start-block compact">
                <button className="entry-start-btn" onClick={handleStartSolo}>
                  Start <span>→</span>
                </button>
                <button className="entry-more-settings" onClick={() => setOverlay('settings')}>
                  Settings
                </button>
              </div>
            </>
          )}

          {tab === 'host' && firebaseReady && (
            <div className="entry-start-block" style={{ marginTop: 0 }}>
              <div className="entry-field-group">
                <div className="entry-field-heading"><span>Your Name</span></div>
                <input className="text-input" style={{ marginBottom: 10 }} value={hostName} onChange={(e) => setHostName(e.target.value)} maxLength={32} placeholder="e.g. Sam" />
                <div className="entry-field-heading"><span>Human Seats (2–10, rest fill with AI)</span></div>
                <input
                  className="text-input"
                  type="number"
                  min="2"
                  max="10"
                  value={seatCount}
                  onChange={(e) => setSeatCount(Math.max(2, Math.min(10, Number(e.target.value) || 2)))}
                />
              </div>
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
