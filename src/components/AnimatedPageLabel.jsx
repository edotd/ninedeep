// A plain, static page label — just the current page name (or "Nine Deep" when there isn't
// one), no periodic swap back to the brand wordmark. See Header.jsx/Sidebar.jsx for usage.
export default function AnimatedPageLabel({ page }) {
  // A breadcrumb ("Team → Lineup & Chemistry") reads as a trail rather than a title: smaller,
  // with the arrows in the body font so a missing glyph can't change the bar's height.
  const parts = page ? page.split(' → ') : [];
  const crumb = parts.length > 1;
  return (
    <span className={'topbar-wordmark' + (crumb ? ' crumb' : '')} aria-label={page ? parts.join(' to ') : 'Nine Deep'}>
      {page
        ? <b>{parts.map((part, i) => <span key={i}>{i > 0 && <span className="crumb-arrow" aria-hidden="true"> → </span>}{part}</span>)}</b>
        : <><b>NINE</b> <i>DEEP</i></>}
    </span>
  );
}
