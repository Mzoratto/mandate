import type { LiveMandate, MandateState } from "@/lib/mandate/types";
import { clockTime, MANDATE_STATE, titleCase } from "@/lib/mandate/state";

export default function ExecutionTimeline({ state, mandate }: { state: MandateState; mandate?: LiveMandate }) {
  const testEvidence = mandate?.evidence.find((item) => item.requirementId === "test-report");
  const reviewEvidence = mandate?.evidence.find((item) => item.requirementId === "review-report");
  const action = mandate?.execution?.actions[0];
  const liveSteps = mandate ? [
    { title: "Authority approved", detail: `${mandate.principalId} · immutable digest`, time: clockTime(mandate.approvedAt), state: mandate.approvedAt ? "complete" : "pending" },
    { title: action ? `${titleCase(action.operation)} authorized` : "Await governed action", detail: action ? `${action.effectTypes.map(titleCase).join(" · ")} · ${action.status}` : "No action recorded", time: clockTime(action?.executedAt ?? action?.proposedAt), state: action?.status === "EXECUTED" ? "complete" : action ? "current" : "pending" },
    { title: "Checkout tests", detail: testEvidence?.verified ? `Verified by ${testEvidence.verifiedBy}` : "Evidence pending", time: clockTime(testEvidence?.createdAt), state: testEvidence?.verified ? "complete" : "pending" },
    { title: "Independent review", detail: reviewEvidence?.verified ? `Verified by ${reviewEvidence.verifiedBy}` : "Evidence pending", time: clockTime(reviewEvidence?.createdAt), state: reviewEvidence?.verified ? "complete" : "pending" },
    { title: "Outcome completion", detail: mandate.status === "COMPLETED" ? "All required evidence satisfied" : `Mandate ${mandate.status}`, time: clockTime(mandate.completedAt), state: mandate.status === "COMPLETED" ? "complete" : "current" },
  ] : null;
  const illustrativeSteps = [
    { title: "Inspect repository state", detail: "Completed · evidence captured", time: "14:14", state: "complete" },
    { title: "Create isolated worktree", detail: "Completed · mandate/024-checkout", time: "14:16", state: "complete" },
    { title: "Implement checkout repair", detail: "3 files changed · review passed", time: "14:24", state: "complete" },
    { title: "Run verification suite", detail: state === "boundary" ? "Paused · authority boundary reached" : "182 / 214 checks complete", time: state === "boundary" ? "PAUSED" : "LIVE", state: "current" },
    { title: "Produce completion evidence", detail: state === "boundary" ? "Waiting for authority review" : "Next if verification succeeds", time: "NEXT", state: "pending" },
  ];
  const steps = liveSteps ?? illustrativeSteps;
  return (
    <section className="panel execution-panel" id="execution" aria-labelledby="execution-title">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{mandate ? "GOVERNED EXECUTION" : "AUTONOMOUS EXECUTION"}</div>
          <h2 id="execution-title">Plan adapts. Authority does not.</h2>
        </div>
        <span className="running-badge"><i className="status-dot" />{mandate?.status === "COMPLETED" ? "Completed" : MANDATE_STATE[state].execution}</span>
      </div>
      <ol className="timeline">
        {steps.map((step) => (
          <li key={step.title} className={step.state}>
            <span className="step-marker">{step.state === "complete" ? "✓" : step.state === "current" ? <i /> : null}</span>
            <div><strong>{step.title}</strong><small>{step.detail}</small></div>
            <time>{step.time}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
