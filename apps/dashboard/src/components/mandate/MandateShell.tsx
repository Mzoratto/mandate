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
import { PARTICLE_STATE } from "@/lib/mandate/state";
import type { MandateState } from "@/lib/mandate/types";
import type { HeadShaders } from "@/components/agent/shaders";
export default function MandateShell({ shaders }: { shaders: HeadShaders }) {
  const [state, setState] = useState<MandateState>("within"),
    [active, setActive] = useState("control"),
    [modal, setModal] = useState<"audit" | "amendment" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    else if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  return (
    <div
      className={`mandate-shell state-${state}`}
      style={
        {
          "--state-color": PARTICLE_STATE[state].primary,
          "--state-secondary": PARTICLE_STATE[state].secondary,
        } as CSSProperties
      }
    >
      <MandateSidebar active={active} onNavigate={setActive} />
      <main id="control">
        <MissionHeader onAudit={() => setModal("audit")} />
        <MandateHero state={state} shaders={shaders} />
        <div className="execution-grid">
          <ExecutionTimeline state={state} />
          <HumanAttention
            state={state}
            onReview={() => setModal("amendment")}
          />
        </div>
        <div className="evidence-grid">
          <EvidencePanel state={state} onAudit={() => setModal("audit")} />
          <DemoStateControl state={state} onChange={setState} />
        </div>
        <EvidenceTrails enabled={state === "within"} />
      </main>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClose={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">MANDATE #024 · DEMO RECORD</div>
            <h2 id="dialog-title">
              {modal === "amendment"
                ? "Review authority request"
                : "Execution audit"}
            </h2>
          </div>
          <button aria-label="Close dialog" onClick={() => setModal(null)}>
            ×
          </button>
        </div>
        {modal === "amendment" ? (
          <>
            <p>
              AgentOS requested permission to change the checkout database
              schema. The approved Mandate permits repository-local code and
              tests only.
            </p>
            <dl className="request-details">
              <div>
                <dt>Requested action</dt>
                <dd>Checkout database schema change</dd>
              </div>
              <div>
                <dt>Current authority</dt>
                <dd>Repository-local code + test</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd className="boundary-text">
                  Blocked · amendment not approved
                </dd>
              </div>
            </dl>
            <p className="dialog-note">
              This is a demonstration. No database or external action is
              performed. Rejecting expansion preserves the existing envelope.
            </p>
            <button className="dialog-action" onClick={() => setModal(null)}>
              Reject expansion · keep authority
            </button>
          </>
        ) : (
          <>
            <p>
              Illustrative evidence for the checkout-repair run. All actions
              remain scoped to the approved repository.
            </p>
            <ol className="audit-list">
              {[
                [
                  "14:12:00",
                  "Mandate approved",
                  "Demo principal · Alexa+ fixture · repository-local authority",
                ],
                [
                  "14:14:12",
                  "Repository inspected",
                  "Working state captured before changes",
                ],
                [
                  "14:16:03",
                  "Isolated worktree created",
                  "mandate/024-checkout · no external writes",
                ],
                [
                  "14:24:41",
                  "Independent review passed",
                  "3 files changed · 0 high-severity findings",
                ],
                [
                  "now",
                  state === "boundary"
                    ? "Boundary enforced"
                    : "Verification in progress",
                  state === "boundary"
                    ? "Database schema change blocked. AgentOS paused."
                    : "182 of 214 deterministic checks complete.",
                ],
              ].map(([time, title, detail]) => (
                <li key={title}>
                  <time>{time}</time>
                  <div>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </div>
                </li>
              ))}
            </ol>
            <p className="dialog-note">
              Demo evidence · no live repository is connected.
              <br />
              Particle portrait combines the supplied reference with a CC0
              MakeHuman head.{" "}
              <a
                href="/models/ATTRIBUTION.txt"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 3.0 · credits
              </a>
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
