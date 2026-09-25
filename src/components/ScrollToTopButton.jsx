import { useEffect, useRef, useState } from 'react';

const SHOW_AFTER = 120;

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const scrollTargetRef = useRef(null);

  useEffect(() => {
    const onScroll = (event) => {
      const target = event.target === document ? document.scrollingElement : event.target;
      const targetTop = typeof target?.scrollTop === 'number' ? target.scrollTop : 0;
      const pageTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (targetTop > SHOW_AFTER) scrollTargetRef.current = target;
      setVisible(Math.max(targetTop, pageTop) > SHOW_AFTER);
    };
    document.addEventListener('scroll', onScroll, true);
    onScroll({ target: document });
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="scroll-top-button"
      aria-label="Move to top of page"
      onClick={() => {
        scrollTargetRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setVisible(false);
      }}
    >
      ↑ Top
    </button>
  );
}
