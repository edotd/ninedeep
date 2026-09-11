import PlayoffBracketScreen from './PlayoffBracketScreen';
import PlayoffSeriesScreen from './PlayoffSeriesScreen';

export default function PlayoffsScreen({ state, actions }) {
  if (state.playoff.activeMatchIndex !== null) {
    return <PlayoffSeriesScreen state={state} actions={actions} />;
  }
  return <PlayoffBracketScreen state={state} actions={actions} />;
}
