// A random starting point for the franchise-name field on the Entry screen's Solo tab — never
// required, just a nudge for players who don't have a name in mind yet. Place + mascot, same
// two-word cadence as the AI rivals' names (game/constants.js's AI_NAMES) but team-flavored
// rather than holding-company-flavored: the player owns a club, the AI owns the paperwork.
const PLACES = [
  'Riverside', 'Redwood', 'Cedar Point', 'Union City', 'Lakeside', 'Highland', 'Westbrook',
  'Cascade', 'Sterling', 'Anchor Bay', 'Ironwood', 'Bayview', 'Crestline', 'Fairview',
  'Northfield', 'Harbor Hill', 'Stonegate', 'Milbrook', 'Eastport', 'Summit Ridge',
];

const MASCOTS = [
  'Ironclads', 'Vanguard', 'Marauders', 'Sentinels', 'Rebels', 'Anchors', 'Foundry',
  'Longshots', 'Rangers', 'Miners', 'Wardens', 'Drifters', 'Pioneers', 'Chargers',
  'Watchmen', 'Reapers', 'Prospectors', 'Outlaws', 'Regents', 'Voyagers',
];

export function randomFranchiseName() {
  const place = PLACES[Math.floor(Math.random() * PLACES.length)];
  const mascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
  return `${place} ${mascot}`;
}
