export default function MissionHeader({ onAudit }: { onAudit: () => void }) {
  return (
    <header className="mission-header">
      <div>
        <div className="eyebrow">ILLUSTRATIVE MISSION CONTROL</div>
        <p>Human authority. Autonomous execution. No live services connected.</p>
      </div>
      <div className="header-actions">
        <time className="clock">13:24:53</time>
        <button onClick={onAudit}>View audit</button>
        <span className="avatar" aria-label="Demo principal">
          DP
        </span>
      </div>
    </header>
  );
}
