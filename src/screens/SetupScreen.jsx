import { useState } from 'react';

export default function SetupScreen({ actions }) {
  const [teamName, setTeamName] = useState('');
  return (
    <>
      <div className="screen">
        <h1>Nine Deep</h1>
        <p className="lede">Name your franchise to begin the era. You'll build a roster, manage the cap, and chase championships across 8 seasons against 7 rival ownership groups.</p>
        <input
          className="text-input"
          type="text"
          maxLength={32}
          placeholder="e.g. Riverside Ironclads"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <button className="secondary" style={{ width: '100%', marginBottom: 10 }} onClick={actions.openGlossary}>View Glossary</button>
        <button className="secondary" style={{ width: '100%' }} onClick={actions.openSettings}>Settings</button>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={() => actions.startEra(teamName)}>Start Era</button>
      </div>
    </>
  );
}
