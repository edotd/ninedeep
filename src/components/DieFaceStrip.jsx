// A d10 drawn as a strip of ten colored faces rather than a single cube — the acceptance
// chance for a negotiation offer or a bidding roll is something the GM can see before rolling,
// not just a number (see the design handoff's "no hidden math" framing for both mini-games).
export default function DieFaceStrip({ threshold, walkFaces = [], rolled }) {
  return (
    <div className="dfs-strip">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((face) => {
        const isWalk = walkFaces.includes(face);
        const isSign = face >= threshold;
        const cls = 'dfs-face' + (isWalk ? ' walk' : isSign ? ' sign' : ' counter') + (rolled === face ? ' rolled' : '');
        return <div key={face} className={cls}>{face}</div>;
      })}
    </div>
  );
}
