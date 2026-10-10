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
    text: 'Guard, Forward, or Big. Starting one of each in your five earns the Floor Balance bonus.' },
  { key: 'grade', selector: '.pcard-grade', label: 'Grade',
    text: "A single letter summarizing this player's overall quality, at a glance." },
  { key: 'cost', selector: '.pcard-budgethit-row', label: 'Cost',
    text: 'How much the player counts towards your budget every turn.' },
];

export const RARITY_DETAILS = {
  Core: 'The most common cards. Reliable building blocks with straightforward impact.',
  Prime: 'Less common cards with stronger traits or effects than Core cards.',
  Signature: 'Rare, high-impact cards that can meaningfully shape a franchise or matchup.',
  Legendary: 'The rarest and most powerful cards in the game.',
};

// The rarity label stamped on the card's top-right corner — opens the full rarity ladder
// (RarityInfoPanel) rather than a text modal. `global` because the label sits on the reveal's
// own chrome, outside the card face.
export const rarityLabelNote = (rarity = 'Core') => ({
  key: 'rarityLabel', selector: '.card-reveal-badge', global: true, pad: 14, panel: 'rarity', label: `${rarity} Rarity Scale`, text: '',
});
