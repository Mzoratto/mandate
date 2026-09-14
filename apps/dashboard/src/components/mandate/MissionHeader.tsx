import { clockTime } from "@/lib/mandate/state";
import type { DashboardSource } from "@/lib/mandate/types";

export default function MissionHeader({ onAudit, source }: { onAudit: () => void; source: DashboardSource }) {
  const live = source.kind === "live" ? source.mandate : undefined;
  const latest = live?.events.at(-1)?.timestamp;
  const initials = live?.principalId.split(/[-_:]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DP";
  return (
    <header className="mission-header">
      <div>
        <div className="eyebrow">
          {live ? "AUTHENTICATED MISSION CONTROL" : source.kind === "unavailable" ? "MISSION CONTROL UNAVAILABLE" : "ILLUSTRATIVE MISSION CONTROL"}
        </div>
        <p>
          {live ? `Live control-plane record · ${live.status}` : source.kind === "unavailable" ? "No authority data is shown without a verified server connection." : "Human authority. Autonomous execution. No live services connected."}
        </p>
      </div>
      <div className="header-actions">
        <time className="clock" dateTime={latest}>{clockTime(latest)}</time>
        <button onClick={onAudit} disabled={!live && source.kind === "unavailable"}>View audit</button>
        <span className="avatar" aria-label={live ? `Principal ${live.principalId}` : "Demo principal"}>{initials}</span>
      </div>
    </header>
  );
}
