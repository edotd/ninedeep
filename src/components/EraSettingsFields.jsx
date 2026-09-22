// Win Condition + Adjustment Cards controls — used by the Settings screen (mid-era, via
// actions.updateSettings) and the online host's Era Setup step in the Lobby. The solo entry
// screen links to Settings rather than duplicating these controls.
export default function EraSettingsFields({ settings, actions }) {
  const winCondition = settings.winCondition || 'bar';
  const matchupCardsEnabled = settings.matchupCardsEnabled !== false;
  return (
    <>
      <div className="pull-slot">
        <div className="pull-label">Win Condition</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={winCondition === 'bar' ? 'primary' : 'secondary'}
            style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
            onClick={() => actions.updateSettings({ winCondition: 'bar' })}
          >
            Clear Championship Bar
          </button>
          <button
            className={winCondition === 'outright' ? 'primary' : 'secondary'}
            style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
            onClick={() => actions.updateSettings({ winCondition: 'outright' })}
          >
            Win Playoffs
          </button>
        </div>
        <div className="pull-extra">
          {winCondition === 'bar'
            ? "Clear Championship Bar: the Finals winner's rating must clear the bar to be crowned champion."
            : 'Win Playoffs: whoever wins the Finals is champion.'}
        </div>
      </div>
      <div className="pull-slot">
        <div className="pull-label">Adjustment Cards</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={matchupCardsEnabled ? 'primary' : 'secondary'}
            style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
            onClick={() => actions.updateSettings({ matchupCardsEnabled: true })}
          >
            On
          </button>
          <button
            className={!matchupCardsEnabled ? 'primary' : 'secondary'}
            style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
            onClick={() => actions.updateSettings({ matchupCardsEnabled: false })}
          >
            Off
          </button>
        </div>
        <div className="pull-extra">When on, every team pulls Adjustment cards each season and can play them during playoff matchups. Turning this off skips the Adjustment Cards step entirely.</div>
      </div>
    </>
  );
}
