// What each tappable region of a Front Office card means — shared by Card Types (hover hotspots)
// and the onboarding card reveals (tap to learn).
export const COACH_NOTES = [
  { key: 'type', selector: '.fo2-name', label: 'Type',
    text: "The coach's archetype — who they are, independent of the specific trait rolled below." },
  { key: 'modifier', selector: '.fo2-disposition', label: 'Modifier',
    text: 'The one trait that makes this coach distinct — the headline word for the whole card, explained in full at the bottom.' },
  { key: 'offbonus', selector: '.fo2-effect-off-bonus', label: 'Offensive Bonus and Die',
    text: "This coach's Offense bonus, shown here as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
  { key: 'defbonus', selector: '.fo2-effect-def-bonus', label: 'Defensive Bonus and Die',
    text: "This coach's Defense bonus, shown here as a percentage — and as a die size (Off/Def) next to the Coach label at the top of the card." },
  { key: 'gameplan', selector: '.fo2-rarity-lead', label: 'Gameplan',
    text: 'Every coach permanently holds two Gameplans, Primary and Secondary — pick one per season on the Set Lineup screen for a team-wide bonus.' },
  { key: 'relations', selector: '.fo2-effect-player-relations', label: 'Player Relations',
    text: "How well this coach works with the roster — a stronger relationship adds to both the Offense and Defense bonus above." },
  { key: 'development', selector: '.fo2-effect-development-points', label: 'Development Points',
    text: 'Points awarded each season to permanently improve a player’s stats, in whichever categories this coach’s style favors.' },
  { key: 'adjustments', selector: '.fo2-effect-in-game-adjustments', label: 'In-Game Adjustments',
    text: 'How many Adjustment cards this coach rolls fresh at the start of every playoff match.' },
];

export const GM_NOTES = [
  { key: 'type', selector: '.fo2-name', label: 'General Manager',
    text: 'Your front office lead. Where the coach runs the games, the GM works the business side of the franchise.' },
  { key: 'rarity', selector: '.fo2-header .pcard-rarity-label', label: 'Rarity',
    text: 'How rare this GM is: Core, Prime, Signature or Legendary. Rarer GMs carry stronger traits.' },
  { key: 'trait', selector: '.fo2-disposition', label: 'Trait',
    text: 'The one special ability this GM brings. The full effect is spelled out at the bottom of the card.' },
  { key: 'cost', selector: '.fo2-effect-cost', label: 'Cost',
    text: 'How much this GM counts towards your budget every turn.' },
  { key: 'budget', selector: '.fo2-effect-budget-increase', label: 'Budget Increase',
    text: 'Extra budget this GM adds to your franchise. Only some GMs have it.' },
  { key: 'detail', selector: '.fo2-mod-detail', label: 'What It Does',
    text: 'Exactly what this GM’s trait does for your franchise.' },
];
