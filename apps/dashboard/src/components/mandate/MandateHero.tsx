"use client";
import dynamic from "next/dynamic";
import AuthorityMeter from "./AuthorityMeter";
import MandateDetails from "./MandateDetails";
import type { MandateState } from "@/lib/mandate/types";
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
}: {
  state: MandateState;
  shaders: HeadShaders;
}) {
  return (
    <section
      className="hero panel"
      id="mandate"
      aria-labelledby="mandate-title"
    >
      <div className="hero-copy">
        <span className="approval">
          <i className="alexa-icon" />
          Demo approval via Alexa+
        </span>
        <div className="mandate-id eyebrow">DEMO MANDATE #024</div>
        <h1 id="mandate-title">
          <span>Restore checkout</span>
          <span>without scope creep</span>
        </h1>
        <p className="mandate-description">
          AgentOS may inspect the repository, create an isolated worktree,
          implement a checkout repair and run tests. Database changes,
          production writes and external deployment are not authorized.
        </p>
        <AuthorityMeter state={state} />
        <MandateDetails />
      </div>
      <AgentParticleScene state={state} shaders={shaders} />
    </section>
  );
}
