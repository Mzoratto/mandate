import { MANDATE_STATE } from "@/lib/mandate/state";
import type { LiveMandate, MandateState } from "@/lib/mandate/types";
import MandateAmendment from "./MandateAmendment";
export default function HumanAttention({
  state,
  onReview,
  mandate,
}: {
  state: MandateState;
  onReview: () => void;
  mandate?: LiveMandate;
}) {
  const copy = mandate?.status === "COMPLETED" ? {
    attention: "Outcome verified",
    body: "All required test and independent-review evidence is authenticated. No human intervention remains open.",
    health: "Mandate completed",
    detail: "Authority closed without expansion.",
  } : MANDATE_STATE[state];
  return (
    <section
      className="panel attention-panel"
      aria-labelledby="attention-title"
    >
      <div className="panel-heading">
        <div>
          <div className="eyebrow">HUMAN ATTENTION</div>
          <h2 id="attention-title">{copy.attention}</h2>
        </div>
        <span className="attention-count">{state === "within" || mandate?.status === "COMPLETED" ? 0 : 1}</span>
      </div>
      <p>{copy.body}</p>
      <div className="health-status" aria-live="polite">
        {state === "boundary" ? (
          <MandateAmendment onReview={onReview} />
        ) : (
          <>
            <div className="health-orbit" aria-hidden="true">
              <i />
            </div>
            <strong>{copy.health}</strong>
            <small>{copy.detail}</small>
          </>
        )}
      </div>
    </section>
  );
}
