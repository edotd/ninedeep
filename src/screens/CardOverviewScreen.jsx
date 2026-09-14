const SECTIONS = [
  {
    tone: 'players',
    kind: 'Card Type 01',
    title: 'Player Cards',
    count: 'Nine Of Your Nine',
    body: 'The bulk of your hand — nine rostered players, five in your starting five and four on the bench. Stats and cap hit are fixed for the season; contract years count down as seasons pass.',
    fine: [
      { label: 'When', value: 'Set once per season, on the Lineup step' },
      { label: 'What It Carries', value: 'Offense, defense, and cap hit' },
      { label: 'When It Expires', value: 'Contract reaches zero years remaining' },
    ],
  },
  {
    tone: 'co-frontoffice',
    kind: 'Card Type 02',
    title: 'Front Office Cards',
    count: 'Three Of Your Nine',
    body: 'Coach, Fanbase, and Market — three standing arrangements that shape your whole era, not just one game. Pulled once and held through Era 01 unless you spend Team Finances to change them.',
    fine: [
      { label: 'When', value: 'Pulled once, right after your hand is dealt' },
      { label: 'What It Carries', value: 'Coaching bonuses, attendance, and cap boosts' },
      { label: 'How It Changes', value: 'Fire your coach or relocate your market from the Team screen' },
    ],
  },
  {
    tone: 'matchup',
    kind: 'Card Type 03',
    title: 'Matchup Cards',
    count: 'Three Of Your Nine',
    body: "Three modifier cards, dealt fresh each season. Play one during a playoff matchup to swing a roll in your favor — or hold Injury Prevention ready to answer an opponent's card.",
    fine: [
      { label: 'When', value: 'Played during your own offense or defense roll' },
      { label: 'What It Carries', value: 'A one-time swing to a single game' },
      { label: 'Limit', value: 'One card per roll, discarded once played' },
    ],
  },
];

// "Before the Deal" (design brand handoff, 3A) — a one-time overview of the three card types
// shown before any dealing starts, at the very top of a fresh era. No card art here (none of
// the three types have been dealt yet, so there's nothing real to preview) — each section
// states what the type is, when it matters, and what it costs/carries, in the same voice as
// the rest of the brand's plain-language fine print.
export default function CardOverviewScreen({ state, actions }) {
  return (
    <>
      <div className="screen co-screen">
        <div className="co-inner">
          <div className="co-masthead">
            <div className="co-eyebrow">{state.teamName || 'Your Franchise'} · Before The Deal</div>
            <h1 className="co-title">Your Nine</h1>
            <div className="co-meta">
              <div>
                <div className="co-meta-label">Hand Size</div>
                <div className="co-meta-value">Nine Cards</div>
              </div>
              <div>
                <div className="co-meta-label">Card Types</div>
                <div className="co-meta-value accent">Three</div>
              </div>
            </div>
          </div>

          {SECTIONS.map((s) => (
            <div className={'co-section ' + s.tone} key={s.title}>
              <div className="co-section-band">
                <span>{s.kind}</span>
                <span>{s.count}</span>
              </div>
              <div className="co-section-body">
                <div className="co-section-title">{s.title}</div>
                <p className="co-section-text">{s.body}</p>
                <div className="co-fine-grid">
                  {s.fine.map((f) => (
                    <div className="co-fine-cell" key={f.label}>
                      <div className="co-fine-label">{f.label}</div>
                      <div className="co-fine-value">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bottombar">
        <button className="primary" onClick={actions.proceedFromCardOverview}>Deal My Hand</button>
      </div>
    </>
  );
}
