// Win Condition + Matchup Cards controls — used by the Settings screen (mid-era, via
// actions.updateSettings) and the online host's Era Setup step in the Lobby (the solo
// equivalent lives inline on EntryScreen's Solo tab, styled to match that screen instead),
// since state.settings already exists with sane defaults before an era starts.
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
            Championship Bar
          </button>
          <button
            className={winCondition === 'outright' ? 'primary' : 'secondary'}
            style={{ flex: 1, padding: '10px 6px', fontSize: 13 }}
            onClick={() => actions.updateSettings({ winCondition: 'outright' })}
          >
            Win Playoffs Outright
          </button>
        </div>
        <div className="pull-extra">
          {winCondition === 'bar'
            ? "Championship Bar: the Finals winner's rating must clear the bar to be crowned champion — winning isn't automatically enough."
            : 'Win Playoffs Outright: whoever wins the Finals is champion, full stop — no bar to clear.'}
        </div>
      </div>
      <div className="pull-slot">
        <div className="pull-label">Matchup Cards</div>
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
        <div className="pull-extra">When on, every team pulls Matchup Modifier cards each season and can play them during playoff matchups. Turning this off skips the Matchup Cards step entirely.</div>
      </div>
    </>
  );
}
