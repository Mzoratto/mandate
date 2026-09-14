import type { LiveMandate } from "@/lib/mandate/types";

export default function LiveRecordPanel({ mandate }: { mandate: LiveMandate }) {
  const spend = (mandate.execution?.monetarySpentMicroUsd ?? 0) / 1_000_000;
  return (
    <section className="panel demo-panel" aria-labelledby="record-title">
      <div className="eyebrow">LIVE CONTROL-PLANE RECORD</div>
      <h2 id="record-title">Authenticated outcome state</h2>
      <p>Fetched server-side with an identity-bound credential. No bearer secret is sent to this browser.</p>
      <dl className="live-record-meta">
        <div><dt>Execution</dt><dd>{mandate.execution?.id ?? "Not started"}</dd></div>
        <div><dt>Usage</dt><dd>{mandate.execution?.tokensUsed ?? 0} tokens · ${spend.toFixed(6)}</dd></div>
        <div><dt>Request</dt><dd>{mandate.requestId.slice(0, 18)}…</dd></div>
      </dl>
    </section>
  );
}
