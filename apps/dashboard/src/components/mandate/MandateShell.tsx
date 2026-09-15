"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import MandateSidebar from "./MandateSidebar";
import MissionHeader from "./MissionHeader";
import MandateHero from "./MandateHero";
import EvidenceTrails from "./EvidenceTrails";
import ExecutionTimeline from "./ExecutionTimeline";
import HumanAttention from "./HumanAttention";
import EvidencePanel from "./EvidencePanel";
import DemoStateControl from "./DemoStateControl";
import LiveRecordPanel from "./LiveRecordPanel";
import { clockTime, PARTICLE_STATE, stateForStatus, titleCase } from "@/lib/mandate/state";
import type { DashboardSource, MandateState } from "@/lib/mandate/types";
import type { HeadShaders } from "@/components/agent/shaders";

export default function MandateShell({ shaders, source }: { shaders: HeadShaders; source: DashboardSource }) {
  const live = source.kind === "live" ? source.mandate : undefined;
  const [demoState, setDemoState] = useState<MandateState>("within");
  const state = live ? stateForStatus(live.status) : source.kind === "unavailable" ? "attention" : demoState;
  const [active, setActive] = useState("control");
  const [modal, setModal] = useState<"audit" | "amendment" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    else if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  const shellStyle = {
    "--state-color": PARTICLE_STATE[state].primary,
    "--state-secondary": PARTICLE_STATE[state].secondary,
  } as CSSProperties;

  if (source.kind === "unavailable") {
    return (
      <div className="mandate-shell state-attention" style={shellStyle}>
        <MandateSidebar active={active} onNavigate={setActive} source={source} />
        <main id="control">
          <MissionHeader onAudit={() => undefined} source={source} />
          <section className="hero panel" aria-labelledby="unavailable-title">
            <div className="hero-copy">
              <div className="eyebrow">FAIL-CLOSED DATA BOUNDARY</div>
              <h1 id="unavailable-title"><span>Authority records unavailable</span></h1>
              <p className="mandate-description">Mission control will not substitute illustrative records when live authentication, configuration, or response validation fails.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const auditEvents = live?.events.slice(-6) ?? [];
  return (
    <div className={`mandate-shell state-${state}`} style={shellStyle}>
      <MandateSidebar active={active} onNavigate={setActive} source={source} />
      <main id="control">
        <MissionHeader onAudit={() => setModal("audit")} source={source} />
        <MandateHero state={state} shaders={shaders} source={source} />
        <div className="execution-grid">
          <ExecutionTimeline state={state} mandate={live} />
          <HumanAttention state={state} mandate={live} onReview={() => setModal("amendment")} />
        </div>
        <div className="evidence-grid">
          <EvidencePanel state={state} mandate={live} onAudit={() => setModal("audit")} />
          {live ? <LiveRecordPanel mandate={live} /> : <DemoStateControl state={state} onChange={setDemoState} />}
        </div>
        <EvidenceTrails enabled={state === "within"} />
      </main>
      <dialog ref={dialog} onCancel={() => setModal(null)} onClose={() => setModal(null)} onClick={(event) => { if (event.target === dialog.current) setModal(null); }} aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">{live ? `${live.id} · AUTHENTICATED RECORD` : "MANDATE #024 · DEMO RECORD"}</div>
            <h2 id="dialog-title">{modal === "amendment" ? "Review authority request" : "Execution audit"}</h2>
          </div>
          <button aria-label="Close dialog" onClick={() => setModal(null)}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </div>
        {modal === "amendment" ? (
          <>
            <p>{live ? "This record contains no approved authority expansion. A new immutable version would require a separate principal decision." : "AgentOS requested permission to change the checkout database schema. The approved Mandate permits repository-local code and tests only."}</p>
            <p className="dialog-note">No external action is performed. Rejecting expansion preserves the existing envelope.</p>
            <button className="dialog-action" onClick={() => setModal(null)}>Keep existing authority</button>
          </>
        ) : (
          <>
            <p>{live ? `Ordered events returned by the authenticated control plane. Request ${live.requestId}.` : "Illustrative evidence for the checkout-repair run. All actions remain scoped to the approved repository."}</p>
            <ol className="audit-list">
              {(live ? auditEvents.map((event) => [clockTime(event.timestamp), titleCase(event.type), event.actor]) : [
                ["14:12:00", "Mandate approved", "Demo principal · Alexa+ fixture"],
                ["14:14:12", "Repository inspected", "Working state captured before changes"],
                ["14:16:03", "Isolated worktree created", "mandate/024-checkout · no external writes"],
                ["14:24:41", "Independent review passed", "0 high-severity findings"],
                ["now", state === "boundary" ? "Boundary enforced" : "Verification in progress", state === "boundary" ? "Database schema change blocked" : "182 of 214 checks complete"],
              ]).map(([time, title, detail], index) => (
                <li key={`${title}-${index}`}><time>{time}</time><div><strong>{title}</strong><small>{detail}</small></div></li>
              ))}
            </ol>
            <p className="dialog-note">
              {live ? "Live record · credentials remain server-side · responses are not cached." : "Demo evidence · no live repository is connected."}<br />
              Particle portrait is generated from bundled CC0 geometry and MIT-licensed procedural noise. <a href="/models/ATTRIBUTION.txt" target="_blank" rel="noreferrer">CC0 + MIT · credits</a>
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
