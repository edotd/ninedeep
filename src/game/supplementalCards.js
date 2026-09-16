// Canonical 97-card deck. Values and rarities are fixed; each definition appears once per season.
const DEFINITIONS = [
  {
    "definitionId": "matchup-001",
    "name": "Strong Finish",
    "category": "Seeding",
    "description": "+5% Seeding Roll",
    "rarity": "Core",
    "effectType": "SEEDING_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-002",
    "name": "Favorable Schedule",
    "category": "Seeding",
    "description": "+5% Seeding Roll",
    "rarity": "Core",
    "effectType": "SEEDING_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-003",
    "name": "Home Stand",
    "category": "Seeding",
    "description": "+5% Seeding Roll",
    "rarity": "Core",
    "effectType": "SEEDING_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-004",
    "name": "Winning Streak",
    "category": "Seeding",
    "description": "+5% Seeding Roll",
    "rarity": "Core",
    "effectType": "SEEDING_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-005",
    "name": "Veteran Consistency",
    "category": "Seeding",
    "description": "+10% Seeding Roll",
    "rarity": "Prime",
    "effectType": "SEEDING_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-006",
    "name": "Statement Wins",
    "category": "Seeding",
    "description": "+10% Seeding Roll",
    "rarity": "Prime",
    "effectType": "SEEDING_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-007",
    "name": "Late-Season Surge",
    "category": "Seeding",
    "description": "+10% Seeding Roll",
    "rarity": "Prime",
    "effectType": "SEEDING_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-008",
    "name": "League's Hottest Team",
    "category": "Seeding",
    "description": "+15% Seeding Roll",
    "rarity": "Signature",
    "effectType": "SEEDING_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-009",
    "name": "Dominant Campaign",
    "category": "Seeding",
    "description": "+15% Seeding Roll",
    "rarity": "Signature",
    "effectType": "SEEDING_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-010",
    "name": "Historic Regular Season",
    "category": "Seeding",
    "description": "+25% Seeding Roll",
    "rarity": "Legendary",
    "effectType": "SEEDING_PERCENT",
    "value": 25
  },
  {
    "definitionId": "matchup-011",
    "name": "Extra Shooting Practice",
    "category": "Offense",
    "description": "+5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-012",
    "name": "Early Offense",
    "category": "Offense",
    "description": "+5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-013",
    "name": "Second-Side Action",
    "category": "Offense",
    "description": "+5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-014",
    "name": "Paint Touches",
    "category": "Offense",
    "description": "+5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-015",
    "name": "Drive and Kick",
    "category": "Offense",
    "description": "+5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-016",
    "name": "Poor Spacing",
    "category": "Offense",
    "description": "−5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-017",
    "name": "Stagnant Possessions",
    "category": "Offense",
    "description": "−5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-018",
    "name": "Cold Shooting Night",
    "category": "Offense",
    "description": "−5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-019",
    "name": "Forced Isolation",
    "category": "Offense",
    "description": "−5% Offensive Ability",
    "rarity": "Core",
    "effectType": "OFFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-020",
    "name": "Focused Film Session",
    "category": "Offense",
    "description": "+10% Offensive Ability",
    "rarity": "Prime",
    "effectType": "OFFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-021",
    "name": "Five-Out Attack",
    "category": "Offense",
    "description": "+10% Offensive Ability",
    "rarity": "Prime",
    "effectType": "OFFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-022",
    "name": "Hot Hand",
    "category": "Offense",
    "description": "+10% Offensive Ability",
    "rarity": "Prime",
    "effectType": "OFFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-023",
    "name": "Pace and Space",
    "category": "Offense",
    "description": "+10% Offensive Ability",
    "rarity": "Prime",
    "effectType": "OFFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-024",
    "name": "Scouted Tendencies",
    "category": "Offense",
    "description": "−10% Offensive Ability",
    "rarity": "Prime",
    "effectType": "OFFENSE_PERCENT",
    "value": -10
  },
  {
    "definitionId": "matchup-025",
    "name": "Empty-Side Action",
    "category": "Offense",
    "description": "+15% Offensive Ability",
    "rarity": "Signature",
    "effectType": "OFFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-026",
    "name": "Half-Court Clinic",
    "category": "Offense",
    "description": "+15% Offensive Ability",
    "rarity": "Signature",
    "effectType": "OFFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-027",
    "name": "Unstoppable Two-Man Game",
    "category": "Offense",
    "description": "+15% Offensive Ability",
    "rarity": "Signature",
    "effectType": "OFFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-028",
    "name": "Offensive Avalanche",
    "category": "Offense",
    "description": "+25% Offensive Ability",
    "rarity": "Legendary",
    "effectType": "OFFENSE_PERCENT",
    "value": 25
  },
  {
    "definitionId": "matchup-029",
    "name": "Active Hands",
    "category": "Defense",
    "description": "+5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-030",
    "name": "Closeout Drill",
    "category": "Defense",
    "description": "+5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-031",
    "name": "Protect the Paint",
    "category": "Defense",
    "description": "+5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-032",
    "name": "Ball Pressure",
    "category": "Defense",
    "description": "+5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-033",
    "name": "Deny the Wing",
    "category": "Defense",
    "description": "+5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": 5
  },
  {
    "definitionId": "matchup-034",
    "name": "Slow Rotations",
    "category": "Defense",
    "description": "−5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-035",
    "name": "Lost on the Switch",
    "category": "Defense",
    "description": "−5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-036",
    "name": "Defensive Miscommunication",
    "category": "Defense",
    "description": "−5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-037",
    "name": "Late Closeouts",
    "category": "Defense",
    "description": "−5% Defensive Ability",
    "rarity": "Core",
    "effectType": "DEFENSE_PERCENT",
    "value": -5
  },
  {
    "definitionId": "matchup-038",
    "name": "Switch Everything",
    "category": "Defense",
    "description": "+10% Defensive Ability",
    "rarity": "Prime",
    "effectType": "DEFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-039",
    "name": "Physical Coverage",
    "category": "Defense",
    "description": "+10% Defensive Ability",
    "rarity": "Prime",
    "effectType": "DEFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-040",
    "name": "Shrink the Floor",
    "category": "Defense",
    "description": "+10% Defensive Ability",
    "rarity": "Prime",
    "effectType": "DEFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-041",
    "name": "Ice the Screen",
    "category": "Defense",
    "description": "+10% Defensive Ability",
    "rarity": "Prime",
    "effectType": "DEFENSE_PERCENT",
    "value": 10
  },
  {
    "definitionId": "matchup-042",
    "name": "Foul Trouble",
    "category": "Defense",
    "description": "−10% Defensive Ability",
    "rarity": "Prime",
    "effectType": "DEFENSE_PERCENT",
    "value": -10
  },
  {
    "definitionId": "matchup-043",
    "name": "Weak-Side Help",
    "category": "Defense",
    "description": "+15% Defensive Ability",
    "rarity": "Signature",
    "effectType": "DEFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-044",
    "name": "Clamp Down",
    "category": "Defense",
    "description": "+15% Defensive Ability",
    "rarity": "Signature",
    "effectType": "DEFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-045",
    "name": "No Easy Looks",
    "category": "Defense",
    "description": "+15% Defensive Ability",
    "rarity": "Signature",
    "effectType": "DEFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-046",
    "name": "Fortress Defense",
    "category": "Defense",
    "description": "+15% Defensive Ability",
    "rarity": "Signature",
    "effectType": "DEFENSE_PERCENT",
    "value": 15
  },
  {
    "definitionId": "matchup-047",
    "name": "Extra Reps",
    "category": "Player Stat",
    "description": "+1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-048",
    "name": "Fresh Legs",
    "category": "Player Stat",
    "description": "+1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-049",
    "name": "Veteran Advice",
    "category": "Player Stat",
    "description": "+1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-050",
    "name": "Confidence Boost",
    "category": "Player Stat",
    "description": "+1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-051",
    "name": "Rhythm Game",
    "category": "Player Stat",
    "description": "+1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-052",
    "name": "Minor Knock",
    "category": "Player Stat",
    "description": "−1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-053",
    "name": "Off Night",
    "category": "Player Stat",
    "description": "−1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-054",
    "name": "Heavy Legs",
    "category": "Player Stat",
    "description": "−1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-055",
    "name": "Distracted",
    "category": "Player Stat",
    "description": "−1 to one Player Stat",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-056",
    "name": "Personal Trainer",
    "category": "Player Stat",
    "description": "+2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-057",
    "name": "Locked In",
    "category": "Player Stat",
    "description": "+2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-058",
    "name": "Breakout Performance",
    "category": "Player Stat",
    "description": "+2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-059",
    "name": "Perfect Preparation",
    "category": "Player Stat",
    "description": "+2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-060",
    "name": "Playing Through Pain",
    "category": "Player Stat",
    "description": "−2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": -2
  },
  {
    "definitionId": "matchup-061",
    "name": "Confidence Shaken",
    "category": "Player Stat",
    "description": "−2 to one Player Stat",
    "rarity": "Prime",
    "effectType": "PLAYER_STAT_MOD",
    "value": -2
  },
  {
    "definitionId": "matchup-062",
    "name": "Career Night",
    "category": "Player Stat",
    "description": "+3 to one Player Stat",
    "rarity": "Signature",
    "effectType": "PLAYER_STAT_MOD",
    "value": 3
  },
  {
    "definitionId": "matchup-063",
    "name": "Playoff Mode",
    "category": "Player Stat",
    "description": "+3 to one Player Stat",
    "rarity": "Signature",
    "effectType": "PLAYER_STAT_MOD",
    "value": 3
  },
  {
    "definitionId": "matchup-064",
    "name": "Superstar Takeover",
    "category": "Player Stat",
    "description": "+3 to one Player Stat",
    "rarity": "Signature",
    "effectType": "PLAYER_STAT_MOD",
    "value": 3
  },
  {
    "definitionId": "matchup-065",
    "name": "Targeted All Night",
    "category": "Player Stat",
    "description": "−3 to one Player Stat",
    "rarity": "Signature",
    "effectType": "PLAYER_STAT_MOD",
    "value": -3
  },
  {
    "definitionId": "matchup-066",
    "name": "Legacy Performance",
    "category": "Player Stat",
    "description": "+4 to one Player Stat",
    "rarity": "Legendary",
    "effectType": "PLAYER_STAT_MOD",
    "value": 4
  },
  {
    "definitionId": "matchup-067",
    "name": "Friendly Bounce",
    "category": "Dice",
    "description": "+1 Dice Value",
    "rarity": "Core",
    "effectType": "DICE_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-068",
    "name": "Home Cooking",
    "category": "Dice",
    "description": "+1 Dice Value",
    "rarity": "Core",
    "effectType": "DICE_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-069",
    "name": "Questionable Call",
    "category": "Dice",
    "description": "−1 Dice Value",
    "rarity": "Core",
    "effectType": "DICE_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-070",
    "name": "Butterfingers",
    "category": "Dice",
    "description": "−1 Dice Value",
    "rarity": "Core",
    "effectType": "DICE_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-071",
    "name": "Crowd Eruption",
    "category": "Dice",
    "description": "+1 Dice Value",
    "rarity": "Core",
    "effectType": "DICE_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-072",
    "name": "Coach's Challenge",
    "category": "Dice",
    "description": "+2 Dice Value",
    "rarity": "Prime",
    "effectType": "DICE_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-073",
    "name": "Superstar Whistle",
    "category": "Dice",
    "description": "+2 Dice Value",
    "rarity": "Prime",
    "effectType": "DICE_MOD",
    "value": 2
  },
  {
    "definitionId": "matchup-074",
    "name": "Technical Foul",
    "category": "Dice",
    "description": "−2 Dice Value",
    "rarity": "Prime",
    "effectType": "DICE_MOD",
    "value": -2
  },
  {
    "definitionId": "matchup-075",
    "name": "Momentum Killer",
    "category": "Dice",
    "description": "−2 Dice Value",
    "rarity": "Prime",
    "effectType": "DICE_MOD",
    "value": -2
  },
  {
    "definitionId": "matchup-076",
    "name": "Biased Officiating",
    "category": "Dice",
    "description": "+3 Dice Value",
    "rarity": "Signature",
    "effectType": "DICE_MOD",
    "value": 3
  },
  {
    "definitionId": "matchup-077",
    "name": "Advance Scout",
    "category": "Matchup",
    "description": "+1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-078",
    "name": "Extra Preparation",
    "category": "Matchup",
    "description": "+1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-079",
    "name": "Familiar Opponent",
    "category": "Matchup",
    "description": "+1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-080",
    "name": "Assistant Coach Intel",
    "category": "Matchup",
    "description": "+1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": 1
  },
  {
    "definitionId": "matchup-081",
    "name": "Short Turnaround",
    "category": "Matchup",
    "description": "−1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-082",
    "name": "Limited Film",
    "category": "Matchup",
    "description": "−1 Matchup Card",
    "rarity": "Prime",
    "effectType": "MATCHUP_CARD_MOD",
    "value": -1
  },
  {
    "definitionId": "matchup-083",
    "name": "Home Court",
    "category": "Advantage",
    "description": "Gain Advantage",
    "rarity": "Prime",
    "effectType": "ADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-084",
    "name": "Rest Advantage",
    "category": "Advantage",
    "description": "Gain Advantage",
    "rarity": "Prime",
    "effectType": "ADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-085",
    "name": "Mismatch Hunting",
    "category": "Advantage",
    "description": "Gain Advantage",
    "rarity": "Signature",
    "effectType": "ADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-086",
    "name": "Perfect Counter",
    "category": "Advantage",
    "description": "Gain Advantage",
    "rarity": "Signature",
    "effectType": "ADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-087",
    "name": "Back-to-Back",
    "category": "Disadvantage",
    "description": "Gain Disadvantage",
    "rarity": "Prime",
    "effectType": "DISADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-088",
    "name": "Hostile Environment",
    "category": "Disadvantage",
    "description": "Gain Disadvantage",
    "rarity": "Prime",
    "effectType": "DISADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-089",
    "name": "Coaching Blunder",
    "category": "Disadvantage",
    "description": "Gain Disadvantage",
    "rarity": "Signature",
    "effectType": "DISADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-090",
    "name": "Short Rotation",
    "category": "Disadvantage",
    "description": "Gain Disadvantage",
    "rarity": "Signature",
    "effectType": "DISADVANTAGE",
    "value": null
  },
  {
    "definitionId": "matchup-091",
    "name": "Earn Your Contract",
    "category": "Player Stat",
    "description": "Add this starter’s cap hit to one chosen stat for this matchup",
    "rarity": "Signature",
    "effectType": "CAP_HIT_STAT",
    "value": null
  },
  {
    "definitionId": "matchup-092",
    "name": "Three-Guard Attack",
    "category": "Offense",
    "description": "+5% Offense per starting Guard",
    "rarity": "Prime",
    "effectType": "POSITION_PERCENT",
    "value": 5,
    "position": "Guard",
    "ability": "offense"
  },
  {
    "definitionId": "matchup-093",
    "name": "Switchable Wings",
    "category": "Defense",
    "description": "+5% Defense per starting Forward",
    "rarity": "Prime",
    "effectType": "POSITION_PERCENT",
    "value": 5,
    "position": "Forward",
    "ability": "defense"
  },
  {
    "definitionId": "matchup-094",
    "name": "Own the Paint",
    "category": "Defense",
    "description": "+5% Defense per starting Big",
    "rarity": "Prime",
    "effectType": "POSITION_PERCENT",
    "value": 5,
    "position": "Big",
    "ability": "defense"
  },
  {
    "definitionId": "matchup-095",
    "name": "Interior Pressure",
    "category": "Offense",
    "description": "+5% Offense per starting Big",
    "rarity": "Prime",
    "effectType": "POSITION_PERCENT",
    "value": 5,
    "position": "Big",
    "ability": "offense"
  },
  {
    "definitionId": "matchup-096",
    "name": "Positionless Basketball",
    "category": "Offense",
    "description": "+10% Offense if Guard, Forward, and Big are all starting",
    "rarity": "Prime",
    "effectType": "POSITION_COVERAGE_PERCENT",
    "value": 10,
    "ability": "offense"
  },
  {
    "definitionId": "matchup-097",
    "name": "Bargain Production",
    "category": "Player Stat",
    "description": "+2 to one stat on a starter with a cap hit of 1 or less",
    "rarity": "Core",
    "effectType": "PLAYER_STAT_MOD",
    "value": 2,
    "maxSalary": 1
  }
];

export const MATCHUP_MODIFIER_TYPES = DEFINITIONS.map((card) => ({
  ...card, weight: 1, flavor: card.description,
  target: card.value < 0 || card.effectType === 'DISADVANTAGE' ? 'opponent' : 'self',
  playable: card.effectType !== 'SEEDING_PERCENT',
  passive: card.effectType === 'SEEDING_PERCENT' ? 'seeding' : null,
  targetsPlayer: ['PLAYER_STAT_MOD', 'CAP_HIT_STAT'].includes(card.effectType),
}));

