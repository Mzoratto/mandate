import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { getAgentWorkStatus, validWorkReference, type AgentWorkStatus } from "@/lib/mandate/mcp-client";
import { prepareWork } from "./actions";
import SubmitWorkButton from "./SubmitWorkButton";

export const metadata: Metadata = {
  title: "Simulated Alexa+ Client — Mandate",
  description: "A protected simulated Alexa+ client using Mandate's deployed MCP boundary.",
};

type Search = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadStatus(reference: string | undefined, enabled: boolean): Promise<AgentWorkStatus | undefined> {
  if (!enabled || !reference || !validWorkReference(reference)) return undefined;
  try {
    return await getAgentWorkStatus(reference);
  } catch {
    return undefined;
  }
}

function stateTone(state: string): string {
  if (state === "COMPLETED") return "verified";
  if (state === "AWAITING_APPROVAL" || state === "PROPOSED" || state === "DRAFT" || state === "AMENDMENT_PENDING") return "review";
  if (state === "ACTIVE") return "active";
  return "closed";
}

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const reference = first(search.reference);
  const error = first(search.error);
  const justPrepared = first(search.prepared) === "1";
  const mcpConfigured = process.env.MANDATE_DASHBOARD_MODE !== "illustrative"
    && Boolean(process.env.MANDATE_CONTROL_PLANE_URL)
    && Boolean(process.env.MANDATE_DASHBOARD_CREDENTIAL);
  const status = await loadStatus(reference, mcpConfigured);
  const requestKey = `sim-${randomUUID()}`;

  return (
    <div className="alexa-simulator">
      <header className="alexa-lab-header">
        <a className="alexa-lab-brand" href="/" aria-label="Mandate public demonstration">
          <span>M</span>
          <strong>MANDATE<small>OUTCOME-BOUND AUTHORITY</small></strong>
        </a>
        <div className="alexa-lab-route">PROTECTED OPERATOR LAB</div>
        <nav aria-label="Mandate surfaces">
          <a href="/">Guided demo</a>
          <a href="/dashboard">Operator record</a>
        </nav>
      </header>

      <main>
        <section className="alexa-lab-intro" aria-labelledby="simulator-title">
          <div>
            <div className="alexa-channel"><i /> SIMULATED ALEXA+ CLIENT · DEVELOPMENT CREDENTIAL BRIDGE</div>
            <h1 id="simulator-title">Say the outcome.<br />Mandate defines the boundary.</h1>
            <p>This protected fallback sends the same MCP tool calls intended for Alexa+, while Amazon account onboarding remains unavailable.</p>
          </div>
          <dl className="connection-truth" aria-label="Connection truth">
            <div><dt>CLIENT SURFACE</dt><dd>Simulated Alexa+</dd></div>
            <div><dt>MCP ENDPOINT</dt><dd className={mcpConfigured ? "truth-live" : undefined}>{mcpConfigured ? "Live · server-only" : "Unavailable"}</dd></div>
            <div><dt>ACCOUNT LINKING</dt><dd className="truth-review">Blocked externally</dd></div>
            <div><dt>APPROVAL</dt><dd>Not exposed here</dd></div>
          </dl>
        </section>

        <section className="alexa-workspace" aria-label="Simulated Alexa conversation and Mandate response">
          <div className="alexa-conversation">
            <div className="conversation-heading">
              <div>
                <span className="alexa-orb" aria-hidden="true" />
                <div><strong>Alexa+ fallback</strong><small>SIMULATED CLIENT · {mcpConfigured ? "REAL MCP REQUEST" : "REQUEST PATH DISABLED"}</small></div>
              </div>
              <span>NO VOICE CAPTURE</span>
            </div>

            <div className="utterance user-utterance">
              <span>YOU</span>
              <form action={prepareWork}>
                <label htmlFor="outcome">Desired checkout outcome</label>
                <textarea
                  id="outcome"
                  name="outcome"
                  minLength={10}
                  maxLength={300}
                  required
                  defaultValue="Restore correct coupon totals in the checkout test suite."
                  aria-describedby="outcome-boundary"
                />
                <input type="hidden" name="requestKey" value={requestKey} />
                <div className="utterance-action">
                  <p id="outcome-boundary">Outcome only. The server owns identity, repository, commit, effects, budgets, and verifiers.</p>
                  <SubmitWorkButton enabled={mcpConfigured} />
                </div>
              </form>
            </div>

            <div className="utterance alexa-utterance" aria-live="polite">
              <span>ALEXA+ · SIMULATED RESPONSE</span>
              {error === "invalid_request" ? (
                <p className="response-error">The outcome must contain 10–300 characters. Nothing was created or executed.</p>
              ) : error ? (
                <p className="response-error">Mandate could not prepare the request safely. Nothing executed. Try again later.</p>
              ) : status ? (
                <>
                  <p>{status.summary}</p>
                  <small>{status.nextStep}</small>
                </>
              ) : reference ? (
                <p className="response-error">That work item could not be read through the authenticated MCP boundary.</p>
              ) : (
                <p>Tell me the outcome you want. I can prepare a bounded proposal, but I cannot approve or execute it.</p>
              )}
            </div>
          </div>

          <aside className="authority-envelope" aria-labelledby="envelope-title">
            <div className="envelope-heading">
              <div><span>MANDATE RESPONSE</span><h2 id="envelope-title">Immutable authority envelope</h2></div>
              {status ? <strong className={`envelope-state ${stateTone(status.state)}`}>{status.state.replaceAll("_", " ")}</strong> : <strong className="envelope-state closed">NOT CREATED</strong>}
            </div>

            {status && reference ? (
              <div className="envelope-record">
                {justPrepared && <p className="prepared-notice">A real proposal was persisted. It stopped before approval.</p>}
                <dl>
                  <div><dt>WORK REFERENCE</dt><dd><code>{reference}</code></dd></div>
                  <div><dt>OUTCOME</dt><dd>{status.outcome}</dd></div>
                  <div><dt>RESOURCES</dt><dd>{status.authority.resources.join(" · ")}</dd></div>
                  <div><dt>PERMITTED EFFECTS</dt><dd className="effect-allow">{status.authority.allowedEffects.join(" · ")}</dd></div>
                  <div><dt>FORBIDDEN EFFECTS</dt><dd>{status.authority.forbiddenEffects.join(" · ")}</dd></div>
                </dl>
                <div className="envelope-proof">
                  <div><span>EXECUTION</span><strong>{status.execution ? `${status.execution.actions} actions` : "None"}</strong></div>
                  <div><span>MODEL TOKENS</span><strong>{status.execution?.tokensUsed ?? 0}</strong></div>
                  <div><span>VERIFICATION</span><strong>{status.verification.independentlyVerified} / {status.verification.records}</strong></div>
                </div>
                <p className="approval-boundary"><i /> This is a conversational summary—not an approval screen. No approval, execution, deployment, or merge control exists here.</p>
              </div>
            ) : (
              <div className="envelope-empty">
                <div className="empty-boundary" aria-hidden="true"><i /><i /><i /></div>
                <strong>No authority exists yet.</strong>
                <p>Preparing work creates a live, immutable proposal in <code>AWAITING_APPROVAL</code>. It grants no execution authority.</p>
              </div>
            )}
          </aside>
        </section>

        <section className="alexa-readback" aria-labelledby="readback-title">
          <div>
            <span>MCP 2025-11-25</span>
            <h2 id="readback-title">One backend. Two honestly labeled clients.</h2>
          </div>
          <ol>
            <li><span>01</span><div><strong>Capture outcome</strong><small>Simulated here; Alexa+ remains the primary intended surface.</small></div></li>
            <li><span>02</span><div><strong>Prepare only</strong><small>The live tool stops at human review.</small></div></li>
            <li><span>03</span><div><strong>Keep authority separate</strong><small>Credentials never become approval.</small></div></li>
          </ol>
          <form className="reference-lookup" method="get">
            <label htmlFor="reference">Read an existing work reference</label>
            <div><input id="reference" name="reference" defaultValue={reference} pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" required disabled={!mcpConfigured} /><button type="submit" disabled={!mcpConfigured}>Get status</button></div>
          </form>
        </section>
      </main>

      <footer className="alexa-lab-footer">
        <span>SIMULATED ALEXA+ · NOT AMAZON-HOSTED · NO ACCOUNT LINKING</span>
        <a href="https://github.com/Mzoratto/mandate" target="_blank" rel="noreferrer">Inspect source ↗</a>
      </footer>
    </div>
  );
}
