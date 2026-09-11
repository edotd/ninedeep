import { retentionBonus, retentionDieBump, relationshipBonus } from './cards';
import { formatCoins } from './economy';

export function coachSummary(team) {
  const bonus = retentionBonus(team) + relationshipBonus(team);
  const dieBump = retentionDieBump(team);
  const offPct = Math.round((team.coach.offBonus + bonus) * 100);
  const defPct = Math.round((team.coach.defBonus + bonus) * 100);
  let s = '+' + offPct + '% Off / +' + defPct + '% Def · d' + (team.coach.offDie + dieBump) + ' Off die, d' + (team.coach.defDie + dieBump) + ' Def die · ' + formatCoins(team.coach.salary);
  s += ' · Age ' + team.coach.age + ' · Relationship ' + team.coach.playerRelationship;
  if (team.coach.modifier === 'Collegiate Success' && (team.retainedStreak || 0) > 0) {
    s += ' · Retained ' + team.retainedStreak + ' season' + (team.retainedStreak === 1 ? '' : 's') + ' — ability active';
  } else if (team.coach.ability) {
    s += ' · Ability: retain to stack bonuses';
  }
  return s;
}

export function fanbaseSummary(team) {
  let s = 'Attendance ' + Math.round((team.attendance !== undefined ? team.attendance : 0.5) * 100) + '%';
  if (team.fanbase.name === 'Die Hard') {
    s += ' · Advantage ' + (team.advantageAvailable ? 'available' : 'used this season');
  }
  return s;
}

// Plain-language description of what a playable Matchup Modifier card actually does,
// matching its implementation in game/matchup.js's playCardEffect.
const PLAYABLE_CARD_NOTES = {
  'Injury (Minor)': 'Playable — target an opponent to force one of their random active players out for this matchup (a same-position bench player subs in if they have one). Blocked only if the target holds an Injury Prevention card ready with a high enough value.',
  'Injury (Major)': 'Playable — target an opponent to force one of their random active players out for this matchup (a same-position bench player subs in if they have one). Blocked only if the target holds an Injury Prevention card ready with a high enough value.',
  'Distraction (External)': "Playable — target an opponent to cut their Offense or Defense modifier (whichever gets hit is random) by the card's value percent.",
  'Distraction (Internal)': "Playable — target an opponent to cut their Offense or Defense modifier (whichever gets hit is random) by the card's value percent.",
  'Player Suspension': "Playable — target an opponent: rolls a d10 against the card's value, and on a low roll forces one of their random active players out for this matchup (bench subs in if available).",
  'Biased Officiating': 'Playable — target an opponent to cut their Offense or Defense (whichever gets hit is random) by a flat 2.',
  'Focused Film Session': 'Playable — play it on your own team to add +2 to your Defense for this matchup.',
  'Strategy Advantage': 'Playable — play it on your own team to add +2 to both your Offense and Defense for this matchup.',
  'Divine Intervention': "Playable — play it on your own team to add the card's value as a flat League Modifier to your final score.",
};

export function matchupCardEffectNote(card) {
  return PLAYABLE_CARD_NOTES[card.name] || 'Playable — choose when to use it against an opponent.';
}
