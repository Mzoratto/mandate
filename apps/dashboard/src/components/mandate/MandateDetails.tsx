import { titleCase } from "@/lib/mandate/state";
import type { LiveMandate } from "@/lib/mandate/types";

export default function MandateDetails({ mandate }: { mandate?: LiveMandate }) {
  return (
    <dl className={`mandate-details${mandate ? " live-details" : ""}`}>
      <div>
        <dt>ALLOWED</dt>
        <dd>
          {mandate ? `${mandate.allowedEffects.length} effect classes` : "Code + test"}
          <small>{mandate ? mandate.allowedEffects.map(titleCase).join(" · ") : "Repository-local checkout repair"}</small>
        </dd>
      </div>
      <div>
        <dt>LIMIT</dt>
        <dd>
          {mandate?.monetaryBudgetUsd === undefined ? "No database writes" : `$${mandate.monetaryBudgetUsd.toFixed(2)} maximum`}
          <small>{mandate ? mandate.forbiddenEffects.map(titleCase).join(" · ") : "Requires Mandate amendment"}</small>
        </dd>
      </div>
      <div>
        <dt>APPROVED BY</dt>
        <dd>
          {mandate?.principalId ?? "Demo principal · Alexa+"}
          <small>{mandate ? `Digest ${mandate.versionDigest.slice(0, 18)}…` : "Illustrative fixture · not live"}</small>
        </dd>
      </div>
    </dl>
  );
}
