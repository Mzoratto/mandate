import type { MandateState } from "@/lib/mandate/types";
export default function EvidencePanel({
  state,
  onAudit,
}: {
  state: MandateState;
  onAudit: () => void;
}) {
  const rows = [
    [
      "Worktree isolated",
      "No writes outside authorized repository",
      "14:16:03",
    ],
    ["Independent review passed", "0 high-severity findings", "14:24:41"],
    [
      state === "boundary"
        ? "Authority boundary enforced"
        : "Verification in progress",
      state === "boundary"
        ? "Database change blocked · execution paused"
        : "182 / 214 deterministic checks",
      "now",
    ],
  ];
  return (
    <section
      className="panel evidence-panel"
      id="evidence"
      aria-labelledby="evidence-title"
    >
      <div className="panel-heading">
        <div>
          <div className="eyebrow">RECENT EVIDENCE</div>
          <h2 id="evidence-title">Why you can trust the run</h2>
        </div>
        <button className="text-button" onClick={onAudit}>
          Open trace <span aria-hidden="true">→</span>
        </button>
      </div>
      <ol className="evidence-list">
        {rows.map(([title, detail, time], i) => (
          <li key={title}>
            <span className="evidence-number">0{i + 1}</span>
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
