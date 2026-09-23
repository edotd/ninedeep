import BallMark from './BallMark';

export default function CardBack({ shape = 'strategy' }) {
  return (
    <div className={`nd-card-back ${shape}`} aria-label="Face-down card">
      <div className="nd-card-back-rule" />
      <BallMark size={42} variant="onInk" />
      <span>Nine Deep</span>
      <div className="nd-card-back-rule" />
    </div>
  );
}
