import { useState } from 'react';
import PlayoffBracketScreen from './PlayoffBracketScreen';
import PlayoffSeriesScreen from './PlayoffSeriesScreen';

export default function PlayoffsScreen({ state, actions, myTeamId }) {
  // Which series this browser is watching is local UI state. The match turn/result remains
  // shared in Firestore, but another player starting or simming a series must not navigate
  // everybody else's browser away from the bracket.
  const [viewingMatchIndex, setViewingMatchIndex] = useState(null);

  const openSeries = async (index) => {
    const result = await actions.openSeries(index, myTeamId);
    if (result?.ok && !result.waiting) setViewingMatchIndex(index);
  };

  if (viewingMatchIndex !== null) {
    return <PlayoffSeriesScreen state={state} actions={actions} myTeamId={myTeamId} matchIndex={viewingMatchIndex} onClose={() => setViewingMatchIndex(null)} />;
  }
  return <PlayoffBracketScreen state={state} actions={actions} myTeamId={myTeamId} onOpenSeries={openSeries} />;
}
