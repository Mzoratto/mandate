"use client";
import dynamic from "next/dynamic";
import AuthorityMeter from "./AuthorityMeter";
import MandateDetails from "./MandateDetails";
import type { DashboardSource, MandateState } from "@/lib/mandate/types";
import type { HeadShaders } from "@/components/agent/shaders";
const AgentParticleScene = dynamic(
  () => import("@/components/agent/AgentParticleScene"),
  {
    ssr: false,
    loading: () => (
      <div className="agent-scene">
        <span className="scene-fallback">
          Initializing AgentOS visualization…
        </span>
      </div>
    ),
  },
);
export default function MandateHero({
  state,
  shaders,
  source,
}: {
  state: MandateState;
  shaders: HeadShaders;
  source: DashboardSource;
}) {
  const live = source.kind === "live" ? source.mandate : undefined;
  return (
    <section
      className="hero panel"
      id="mandate"
      aria-labelledby="mandate-title"
    >
      <div className="hero-copy">
        <span className="approval">
          <i className="alexa-icon" />
          {live ? `Authenticated approval · ${live.principalId}` : "Demo approval via Alexa+"}
        </span>
        <div className="mandate-id eyebrow">{live ? `MANDATE ${live.id} · ${live.status}` : "DEMO MANDATE #024"}</div>
        <h1 id="mandate-title" className={live ? "live-title" : undefined}>
          {live ? <span>{live.goal}</span> : <><span>Restore checkout</span><span>without scope creep</span></>}
        </h1>
        <p className="mandate-description">
          {live
            ? `${live.subjectId} operated only in ${live.includePaths.join(" and ")}. ${live.forbiddenEffects.join(", ")} remained forbidden.`
            : "AgentOS may inspect the repository, create an isolated worktree, implement a checkout repair and run tests. Database changes, production writes and external deployment are not authorized."}
        </p>
        <AuthorityMeter state={state} live={Boolean(live)} actionCount={live?.execution?.actions.length ?? 0} />
        <MandateDetails mandate={live} />
      </div>
      <AgentParticleScene
        state={state}
        shaders={shaders}
        agentLabel={live ? `${live.subjectRuntime} · LIVE RECORD` : undefined}
        agentStatus={live?.status}
        step={live?.status === "COMPLETED" ? "Outcome evidence verified" : undefined}
      />
    </section>
  );
}
