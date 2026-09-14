import { useState } from 'react';
import GlossaryScreen from './GlossaryScreen';
import SettingsScreen from './SettingsScreen';
import BallMark from '../components/BallMark';
import EraSettingsFields from '../components/EraSettingsFields';
import { useDarkMode } from '../hooks/useDarkMode';

export default function SetupScreen({ state, actions }) {
  const [teamName, setTeamName] = useState('');
  const [overlay, setOverlay] = useState(null); // null | 'glossary' | 'settings'
  const { darkMode } = useDarkMode();

  if (overlay === 'glossary') return <GlossaryScreen state={state} onBack={() => setOverlay(null)} />;
  if (overlay === 'settings') return <SettingsScreen state={state} actions={actions} onBack={() => setOverlay(null)} />;

  return (
    <>
      <div className="screen">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <BallMark size={56} variant={darkMode ? 'onInk' : 'onFile'} />
          <h1 style={{ margin: 0, fontSize: 52 }}><span className="wordmark-ink">NINE</span> <span style={{ color: 'var(--stamp)' }}>DEEP</span></h1>
        </div>
        <p className="lede">Name your franchise to begin the era. You'll build a roster, manage the cap, and chase championships across 8 seasons against 7 rival ownership groups.</p>
        <input
          className="text-input"
          type="text"
          maxLength={32}
          placeholder="e.g. Riverside Ironclads"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <EraSettingsFields settings={state.settings} actions={actions} />
        <button className="secondary" style={{ width: '100%', marginBottom: 10 }} onClick={() => setOverlay('glossary')}>View Glossary</button>
        <button className="secondary" style={{ width: '100%' }} onClick={() => setOverlay('settings')}>More Settings</button>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={() => actions.startEra(teamName)}>Start Era</button>
      </div>
    </>
  );
}
