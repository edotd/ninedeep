import { useEffect, useState } from 'react';
import { createRoom, joinRoom } from '../firebase/rooms';
import { firebaseReady } from '../firebase/config';
import BallMark from '../components/BallMark';
import GlossaryScreen from './GlossaryScreen';
import SettingsScreen from './SettingsScreen';
import { randomFranchiseName } from '../game/names';

const GLOSSARY_TABS = [
  {
    key: 'basics', label: 'The Basics', rows: [
      { label: 'The Era', text: '10 teams, 8 seasons. Finish the era with the most championships to win the game.' },
      { label: 'The Nine', text: 'Each player gets nine cards to compete with. Supplement your rotation with front office and matchup cards for the best chance at winning.' },
      { label: 'Player Turns', text: 'Each turn has three stages. The season, the playoffs, the draft.' },
    ],
  },
  {
    key: 'cards', label: 'The Cards', rows: [
      { label: 'Player Cards', text: "Rotations consist of 5 starters and 4 bench players. Find the best combination to maximize your team's potential output." },
      { label: 'Front Office Cards', text: 'Use Coach, Fanbase and Market cards to apply bonuses and modifiers to your team.' },
      { label: 'Matchup Cards', text: 'Use matchup cards to target and negatively affect opposing players and teams, or apply bonuses to your own.' },
    ],
  },
  {
    key: 'money', label: 'The Money', rows: [
      { label: 'Salary Cap', text: 'TBD' },
      { label: 'Contracts', text: 'TBD' },
      { label: 'Front Office Moves', text: 'Firing your coach, relocating markets, and investing in your fanbase all spend cap room directly — the same pool that funds your roster.' },
    ],
  },
  {
    key: 'playoffs', label: 'The Playoffs', rows: [
      { label: 'The Bracket', text: '8 teams, single elimination, three rounds.' },
      { label: 'Turn Flow', text: 'Each team gets three rolls: offense, defense and bench. Maximize all three for the best chance at winning.' },
      { label: 'Win Condition', text: 'Choose how a winner is decided: win outright, or surpass the championship bar.' },
    ],
  },
];

// The Entry screen — "1B · The Marquee" from the design brand handoff's Nine Deep Entry
// file. Replaces the old two-step flow (a mode-picker LandingScreen, then a separate
// SetupScreen for naming the solo franchise) with one screen: an ink hero half that carries
// the pitch and a browsable glossary preview, and a cream setup half on the right whose
// content swaps with the Solo/Host/Join tab — Solo's fields (name, win condition, matchup
// cards) sit right here, so starting a solo era is a single "Start The Era" click with
// nothing in between.
export default function EntryScreen({ pendingJoinCode, soloState, soloActions, onStartSolo, onEnterRoom }) {
  const [tab, setTab] = useState(pendingJoinCode ? 'join' : 'solo');
  const [glossaryTab, setGlossaryTab] = useState('basics');
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

  const winCondition = soloState.settings.winCondition || 'outright';
  const matchupCardsEnabled = soloState.settings.matchupCardsEnabled !== false;
  const activeGlossary = GLOSSARY_TABS.find((t) => t.key === glossaryTab) || GLOSSARY_TABS[0];

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
          <p className="entry-tagline">You run a club: sign the rotation, pay the cap, survive the playoffs. Play solo against seven AI ownership groups, or open a room and run the era with friends.</p>

          <div className="entry-glossary">
            <div className="entry-glossary-tabs">
              {GLOSSARY_TABS.map((t) => (
                <button
                  key={t.key}
                  className={'entry-glossary-tab' + (glossaryTab === t.key ? ' active' : '')}
                  onClick={() => setGlossaryTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="entry-glossary-rows">
              {activeGlossary.rows.map((row) => (
                <div className="entry-glossary-row" key={row.label}>
                  <div className="entry-glossary-row-label">{row.label}</div>
                  <div className="entry-glossary-row-text">{row.text}</div>
                </div>
              ))}
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

              <div className="entry-field-group">
                <div className="entry-field-heading">
                  <span>Win Condition</span>
                </div>
                <div className="entry-radio-list">
                  <button className={'entry-radio-row' + (winCondition === 'bar' ? ' active' : '')} onClick={() => soloActions.updateSettings({ winCondition: 'bar' })}>
                    <div>
                      <div className="entry-radio-title">Championship Bar</div>
                      <div className="entry-radio-text">The Finals winner must also clear a rating bar to be crowned.</div>
                    </div>
                    <span className="entry-radio-dot" />
                  </button>
                  <button className={'entry-radio-row' + (winCondition === 'outright' ? ' active' : '')} onClick={() => soloActions.updateSettings({ winCondition: 'outright' })}>
                    <div>
                      <div className="entry-radio-title">Win Playoffs Outright</div>
                      <div className="entry-radio-text">Whoever wins the Finals is champion. No bar to clear.</div>
                    </div>
                    <span className="entry-radio-dot" />
                  </button>
                </div>
              </div>

              <div className="entry-toggle-row">
                <div>
                  <div className="entry-toggle-title">Matchup Cards</div>
                  <div className="entry-toggle-text">Every club pulls them each season and plays them in the playoffs.</div>
                </div>
                <div className="entry-toggle-switch">
                  <button className={matchupCardsEnabled ? 'active' : ''} onClick={() => soloActions.updateSettings({ matchupCardsEnabled: true })}>On</button>
                  <button className={!matchupCardsEnabled ? 'active' : ''} onClick={() => soloActions.updateSettings({ matchupCardsEnabled: false })}>Off</button>
                </div>
              </div>

              <div className="entry-start-block">
                <button className="entry-start-btn" onClick={handleStartSolo}>
                  Start The Era <span>→</span>
                </button>
                <button className="entry-more-settings" onClick={() => setOverlay('settings')}>
                  More Settings · Era Length, Cap Ceiling, AI Difficulty
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
