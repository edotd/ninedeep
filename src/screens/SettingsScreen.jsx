import EraSettingsFields from '../components/EraSettingsFields';
import { useDarkMode } from '../hooks/useDarkMode';

const ACTION_LOG_SPEED_OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'instant', label: 'Instant' },
];

export default function SettingsScreen({ state, actions, onBack, onNewEra }) {
  const s = state.settings;
  const winCondition = s.winCondition || 'bar';
  const { darkMode, setDarkMode } = useDarkMode();
  return (
    <>
      <div className="screen">
        <h1>Settings</h1>
        <p className="lede">House rules for this era. Changes apply immediately — to the next dice roll and the next season's championship bar.</p>
        <div className="pull-slot">
          <div className="pull-label">Display</div>
          <button
            className={darkMode ? 'primary' : 'secondary'}
            style={{ width: '100%' }}
            onClick={() => setDarkMode((d) => !d)}
          >
            {darkMode ? 'Dark Mode — On' : 'Dark Mode — Off'}
          </button>
          <div className="pull-extra">A darker app background — this device only, doesn't sync to other players in a room.</div>
        </div>
        <EraSettingsFields settings={s} actions={actions} />
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
          <div className="pull-extra">
            {winCondition === 'outright'
              ? "Not used while Win Condition is set to Win Playoffs Outright."
              : "The Finals winner's rating must clear (playoff-field average rating × this multiplier) to be crowned champion."}
          </div>
        </div>
        <div className="pull-slot">
          <div className="pull-label">Action Log Speed</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACTION_LOG_SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={s.actionLogSpeed === opt.value ? 'primary' : 'secondary'}
                style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
                onClick={() => actions.updateSettings({ actionLogSpeed: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="pull-extra">How quickly a playoff matchup's Action Log plays out entries — from dice rolls to injuries to card plays. Instant skips the animation entirely.</div>
        </div>
        {onNewEra && (
          <div className="pull-slot">
            <div className="pull-label">Danger Zone</div>
            <button
              className="secondary"
              style={{ width: '100%' }}
              onClick={() => { if (confirm('Start a new era? Current progress will be lost.')) onNewEra(); }}
            >
              New Era
            </button>
            <div className="pull-extra">Resets the era for everyone. Current progress will be lost.</div>
          </div>
        )}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={onBack}>Back</button>
      </div>
    </>
  );
}
