import { useLayoutEffect, useRef, useState } from 'react';

// Card Types only: transparent section hit areas make every explained part look selectable.
// Hovering or focusing a section reveals its short description without changing the real card.
export default function CardAnnotation({ accent, notes, children }) {
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const [activeKey, setActiveKey] = useState(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return undefined;
    const measure = () => {
      const stageRect = stage.getBoundingClientRect();
      setBoxes(notes.flatMap((note) => {
        const target = card.querySelector(note.selector);
        if (!target) return [];
        const rect = target.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return [];
        return [{ ...note, left: rect.left - stageRect.left, top: rect.top - stageRect.top, width: rect.width, height: rect.height }];
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [notes]);

  const active = boxes.find((box) => box.key === activeKey);
  return (
    <div className="co2-stage co2-hotspot-stage" ref={stageRef} style={{ '--hotspot-accent': accent }}>
      <div className="co2-card-slot" ref={cardRef}>{children}</div>
      {boxes.map((box) => (
        <button
          type="button"
          key={box.key}
          className={'co2-hotspot' + (activeKey === box.key ? ' active' : '')}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          aria-label={`${box.label}: ${box.text}`}
          onMouseEnter={() => setActiveKey(box.key)}
          onMouseLeave={() => setActiveKey(null)}
          onFocus={() => setActiveKey(box.key)}
          onBlur={() => setActiveKey(null)}
        />
      ))}
      {active && (
        <div className="co2-hotspot-tooltip" style={{ left: active.left + active.width / 2, top: active.top + active.height + 8 }}>
          <b>{active.label}</b>
          <span>{active.text}</span>
        </div>
      )}
    </div>
  );
}
