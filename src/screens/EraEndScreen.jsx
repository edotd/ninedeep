export default function EraEndScreen({ state, actions }) {
  const sorted = [...state.teams].sort((a, b) => b.titles - a.titles);
  const top = sorted[0].titles;
  const champs = sorted.filter((t) => t.titles === top);
  return (
    <>
      <div className="screen">
        <h1>End of the Era</h1>
        <div className="banner good">{champs.map((c) => c.name).join(' & ')} — {top} title{top === 1 ? '' : 's'}</div>
        <h2>Final Standings</h2>
        {sorted.map((t) => (
          <div key={t.name} className={'standing-row' + (t.human ? ' you' : '')}>
            <span>{t.name}</span><span>{t.titles} titles</span>
          </div>
        ))}
        <h2>Season by Season</h2>
        {state.log.map((l, i) => (
          <div key={i} className="standing-row"><span>Season {l.season}</span><span>{l.champion || 'No champion'}</span></div>
        ))}
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.newEra}>Start New Era</button>
      </div>
    </>
  );
}
