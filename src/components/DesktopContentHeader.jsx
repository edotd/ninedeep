import { formatCoins } from '../game/economy';

// Slim stats strip at the top of the desktop content pane — the lockup, nav and era bar all
// moved to the Sidebar, so this just carries the numbers that change screen to screen.
export default function DesktopContentHeader({ state, myTeamId }) {
  const team = state.teams[myTeamId];
  return (
    <div className="desktop-content-header">
      <div className="tb-cell"><b>{Math.min(state.season, 8)}/8</b><span>Season</span></div>
      <div className="tb-cell"><b>{team.seasonCap !== undefined ? formatCoins(team.seasonCap) : '—'}</b><span>Cap</span></div>
      <div className="tb-cell"><b>{state.bar !== undefined ? Math.round(state.bar) : '—'}</b><span>Bar</span></div>
    </div>
  );
}
