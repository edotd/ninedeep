import { useEffect, useState } from 'react';

export default function AnimatedPageLabel({ page }) {
  const [showBrand, setShowBrand] = useState(false);

  useEffect(() => {
    if (!page || page === 'Nine Deep') return undefined;

    let restoreTimer;
    const brandTimer = window.setInterval(() => {
      setShowBrand(true);
      restoreTimer = window.setTimeout(() => setShowBrand(false), 2000);
    }, 10000);

    return () => {
      window.clearInterval(brandTimer);
      window.clearTimeout(restoreTimer);
    };
  }, [page]);

  return (
    <span className="topbar-wordmark" aria-label={page || 'Nine Deep'}>
      <span key={showBrand ? 'brand' : page} className="topbar-wordmark-swap" aria-hidden="true">
        {showBrand || !page ? <><b>NINE</b> <i>DEEP</i></> : <b>{page}</b>}
      </span>
    </span>
  );
}
