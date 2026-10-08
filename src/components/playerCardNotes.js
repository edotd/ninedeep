// What each tappable region of a player card means — shared by Card Types (hover hotspots) and
// the onboarding card reveal (tap to learn).
export const PLAYER_NOTES = [
  { key: 'archetype', selector: '.pcard-name-block', label: 'Archetype',
    text: 'What this player excels at. There are four total archetypes: Scorer, Playmaker, Rebounder and Defender.' },
  { key: 'stats', selector: '.pcard-stats', label: 'Stats',
    text: "Player stats determine your team's output. Scoring and Playmaking contribute to offense. Defense and Rebounding contribute to defense." },
  { key: 'skillset', selector: '.pcard-skillset', label: 'Skillset',
    text: 'A permanent trait rolled once at creation. Specific skillsets apply bonuses to your team chemistry when paired together.' },
  { key: 'years', selector: '.pcard-years-row', label: 'Turns Remaining',
    text: 'Each dot represents the amount of turns this player will be on your roster.' },
  { key: 'stage', selector: '.pcard-header-stage', label: 'Career Stage',
    text: 'Where the player is at in their career. Different stat bonuses may apply depending on where the player is in their career.' },
  { key: 'tier', selector: '.pcard-header-tier', label: 'Tier',
    text: "The player's ceiling. Applies bonuses to specific stats." },
  { key: 'position', selector: '.pcard-header-pos', label: 'Position',
    text: 'Guard, Forward, or Big. Your starting five needs at least one of each.' },
  { key: 'grade', selector: '.pcard-grade', label: 'Grade',
    text: "A single letter summarizing this player's overall quality, at a glance." },
  { key: 'cost', selector: '.pcard-budgethit-row', label: 'Cost',
    text: 'How much the player counts towards your budget every turn.' },
];

const RARITY_DETAILS = {
  Core: 'The most common cards. Reliable building blocks with straightforward impact.',
  Prime: 'Less common cards with stronger traits or effects than Core cards.',
  Signature: 'Rare, high-impact cards that can meaningfully shape a franchise or matchup.',
  Legendary: 'The rarest and most powerful cards in the game.',
};

// The rarity mark filling a card's lower-right quadrant — tappable in the onboarding reveals.
// `inset` shrinks the tap target to the glyph itself, so it doesn't swallow the quadrant's
// other regions (stats, skillset, accolades).
export const rarityNote = (rarity = 'Core') => ({
  key: 'rarity', selector: '.rarity-ghost', inset: 0.8, label: `${rarity} Rarity`,
  text: `How rare a card is: Core, Prime, Signature or Legendary. ${RARITY_DETAILS[rarity] || ''} Rarity reflects a card's existing power and scarcity. It does not add a separate bonus.`,
});
