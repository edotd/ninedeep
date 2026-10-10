import { RESOURCE_GLYPHS, RESOURCE_META } from './resourceIcons';

// A counter chip: the resource's icon tile and how many there are (design: Resource Icons).
export default function ResourceChip({ kind, count }) {
  const meta = RESOURCE_META[kind];
  return (
    <span className="res-chip" title={`${meta.label}: ${count}`} aria-label={`${meta.label}: ${count}`}>
      <span className="res-chip-tile" style={{ background: meta.bg, color: meta.fg }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: RESOURCE_GLYPHS[kind] }} />
      </span>
      <b>{count}</b>
    </span>
  );
}
