export default function SettingsScreen({ state, actions }) {
  const s = state.settings;
  return (
    <>
      <div className="screen">
        <h1>Settings</h1>
        <p className="lede">House rules for this era. Changes apply immediately — to the next dice roll and the next season's championship bar.</p>
        <div className="pull-slot">
          <div className="pull-label">Injury Chance (per team, per matchup)</div>
          <input
            className="text-input"
            style={{ marginBottom: 0 }}
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(s.injuryChance * 100)}
            onChange={(e) => {
              const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              actions.updateSettings({ injuryChance: pct / 100 });
            }}
          />
          <div className="pull-extra">Percent chance a random active player is injured before each playoff matchup.</div>
        </div>
        <div className="pull-slot">
          <div className="pull-label">Championship Bar Multiplier</div>
          <input
            className="text-input"
            style={{ marginBottom: 0 }}
            type="number"
            min="1"
            max="3"
            step="0.01"
            value={s.championshipBarMult}
            onChange={(e) => {
              const mult = Math.max(1, Number(e.target.value) || 1);
              actions.updateSettings({ championshipBarMult: mult });
            }}
          />
          <div className="pull-extra">The Finals winner's rating must clear (playoff-field average rating × this multiplier) to be crowned champion.</div>
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.closeSettings}>Back</button>
      </div>
    </>
  );
}
