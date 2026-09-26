// A plain, static page label — just the current page name (or "Nine Deep" when there isn't
// one), no periodic swap back to the brand wordmark. See Header.jsx/Sidebar.jsx for usage.
export default function AnimatedPageLabel({ page }) {
  return (
    <span className="topbar-wordmark" aria-label={page || 'Nine Deep'}>
      {page ? <b>{page}</b> : <><b>NINE</b> <i>DEEP</i></>}
    </span>
  );
}
