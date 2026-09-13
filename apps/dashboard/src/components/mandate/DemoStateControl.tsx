import type { MandateState } from "@/lib/mandate/types";
const options: [MandateState, string][] = [
  ["within", "Within Mandate"],
  ["attention", "Needs attention"],
  ["boundary", "Boundary hit"],
];
export default function DemoStateControl({
  state,
  onChange,
}: {
  state: MandateState;
  onChange: (state: MandateState) => void;
}) {
  return (
    <section className="panel demo-panel" aria-labelledby="demo-title">
      <div className="eyebrow">DEMO STATE</div>
      <h2 id="demo-title">Test the authority boundary</h2>
      <p>
        Switch this illustrative agent view between autonomous execution and a
        fail-closed boundary exception.
      </p>
      <div className="segmented-control" role="group" aria-label="Demo state">
        {options.map(([value, label]) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={state === value}
            className={state === value ? "selected" : ""}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
