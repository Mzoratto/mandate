"use client";
import type { DashboardSource } from "@/lib/mandate/types";
export default function MandateSidebar({
  active,
  onNavigate,
  source,
}: {
  active: string;
  onNavigate: (id: string) => void;
  source: DashboardSource;
}) {
  const live = source.kind === "live" ? source.mandate : undefined;
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#control"
        onClick={() => onNavigate("control")}
        aria-label="Mandate control"
      >
        <span className="brand-mark">M</span>
        <span>
          <b>MANDATE</b>
          <small>BOUND AUTONOMY</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {[
          ["control", "Control"],
          ["mandate", "Mandates"],
          ["execution", "Execution"],
          ["evidence", "Evidence"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={active === id ? "active" : ""}
            onClick={() => onNavigate(id)}
            aria-current={active === id ? "location" : undefined}
          >
            <i />
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="connection">
          <i className="status-dot" />
          {live ? "Authenticated · live" : source.kind === "unavailable" ? "Fail closed · offline" : "Demo data · offline"}
        </div>
        <div className="eyebrow">{live ? "AWS · NEON CONTROL PLANE" : "ALEXA+ · ILLUSTRATIVE CHANNEL"}</div>
        <div className="alexa-ready">
          <i className="alexa-icon" />
          {live ? live.subjectRuntime : "Not connected"}
        </div>
      </div>
    </aside>
  );
}
