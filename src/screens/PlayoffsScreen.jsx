import PlayoffBracketScreen from './PlayoffBracketScreen';
import PlayoffSeriesScreen from './PlayoffSeriesScreen';

export default function PlayoffsScreen({ state, actions, myTeamId }) {
  if (state.playoff.activeMatchIndex !== null) {
    return <PlayoffSeriesScreen state={state} actions={actions} myTeamId={myTeamId} />;
  }
  return <PlayoffBracketScreen state={state} actions={actions} myTeamId={myTeamId} />;
}
