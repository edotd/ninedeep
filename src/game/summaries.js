import { retentionBonus, retentionDieBump } from './cards';
import { formatCoins } from './economy';

export function coachSummary(team) {
  const bonus = retentionBonus(team);
  const dieBump = retentionDieBump(team);
  const offPct = Math.round((team.coach.offBonus + bonus) * 100);
  const defPct = Math.round((team.coach.defBonus + bonus) * 100);
  let s = '+' + offPct + '% Off / +' + defPct + '% Def · d' + (team.coach.offDie + dieBump) + ' Off die, d' + (team.coach.defDie + dieBump) + ' Def die · ' + formatCoins(team.coach.salary);
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
