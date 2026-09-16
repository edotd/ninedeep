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

// A short, stable three-letter identifier for any team — used by the sidebar's live standings
// glance. AI teams use the curated AI_TRICODES map (game/constants.js); a player's franchise
// name is free text, so it's derived from initials instead: one word pads/truncates to three
// letters, two words take the first word's initial plus the second word's first two letters,
// three or more take one initial each from the first three words.
export function tricodeFor(name, curated) {
  if (curated && curated[name]) return curated[name];
  const words = (name || '').toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '???';
  if (words.length === 1) return (words[0] + 'XXX').slice(0, 3);
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).slice(0, 3);
  return words.slice(0, 3).map((w) => w[0]).join('');
}
