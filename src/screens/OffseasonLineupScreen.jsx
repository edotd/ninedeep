import OffseasonFile from '../components/OffseasonFile';
import TeamChemistry from '../components/TeamChemistry';

export default function OffseasonLineupScreen({ state, actions, myTeamId }) {
  const team = state.teams[myTeamId];
  const filed = state.offseason?.lineupFiled?.[team.id];
  return <OffseasonFile state={state} team={team}>
    <div className="of-section-label">05 / LINEUP</div><h1>Set the Rotation</h1>
    <p className="lede">Select five starters with at least one Guard, Forward, and Big. The other four players remain on the bench.</p>
    <TeamChemistry team={team} canEdit={!filed} onSwap={(outgoing, incoming) => actions.swapStarter(myTeamId, outgoing, incoming)} />
    <button className="primary of-action" disabled={filed} onClick={() => actions.fileOffseasonLineup(myTeamId)}>{filed ? 'APPROVED · WAITING FOR OTHER CLUBS' : 'APPROVE LINEUP & CLOSE FILE'}</button>
  </OffseasonFile>;
}
