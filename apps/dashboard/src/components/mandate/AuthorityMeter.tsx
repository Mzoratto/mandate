import { MANDATE_STATE } from "@/lib/mandate/state";
import type { MandateState } from "@/lib/mandate/types";
export default function AuthorityMeter({ state }: { state: MandateState }) {
  return (
    <div className="authority">
      <div>
        <div className="eyebrow">AUTHORITY</div>
        <strong>{MANDATE_STATE[state].authority}</strong>
      </div>
      <div
        className="authority-track"
        role="meter"
        aria-label="Authority utilized"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state === "boundary" ? 100 : 62}
      >
        <i style={{ width: state === "boundary" ? "100%" : "62%" }} />
        <b />
      </div>
      <span>
        {state === "boundary" ? (
          "Boundary hit"
        ) : (
          <>
            62% <em>utilized</em>
          </>
        )}
      </span>
    </div>
  );
}
