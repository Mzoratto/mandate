import type { MandateState } from "@/lib/mandate/types";
import { MANDATE_STATE } from "@/lib/mandate/state";
export default function ExecutionTimeline({ state }: { state: MandateState }) {
  const steps = [
    ["Inspect repository state", "Completed · evidence captured", "14:14"],
    [
      "Create isolated worktree",
      "Completed · mandate/024-checkout",
      "14:16",
    ],
    ["Implement checkout repair", "3 files changed · review passed", "14:24"],
    [
      "Run verification suite",
      state === "boundary"
        ? "Paused · authority boundary reached"
        : "182 / 214 checks complete",
      state === "boundary" ? "PAUSED" : "LIVE",
    ],
    [
      "Produce completion evidence",
      state === "boundary"
        ? "Waiting for authority review"
        : "Next if verification succeeds",
      "NEXT",
    ],
  ];
  return (
    <section
      className="panel execution-panel"
      id="execution"
      aria-labelledby="execution-title"
    >
      <div className="panel-heading">
        <div>
          <div className="eyebrow">AUTONOMOUS EXECUTION</div>
          <h2 id="execution-title">Plan adapts. Authority does not.</h2>
        </div>
        <span className="running-badge">
          <i className="status-dot" />
          {MANDATE_STATE[state].execution}
        </span>
      </div>
      <ol className="timeline">
        {steps.map(([title, detail, time], i) => (
          <li
            key={title}
            className={i < 3 ? "complete" : i === 3 ? "current" : "pending"}
          >
            <span className="step-marker">
              {i < 3 ? "✓" : i === 3 ? <i /> : null}
            </span>
            <div>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
            <time>{time}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
