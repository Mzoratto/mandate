"use client";
import { Canvas } from "@react-three/fiber";
import {
  Suspense,
  Component,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import ParticlePortrait from "./ParticlePortrait";
import PortraitBloom from "./PortraitBloom";
import AmbientDust from "./AmbientDust";
import HudRings from "./HudRings";
import { MANDATE_STATE } from "@/lib/mandate/state";
import type { MandateState } from "@/lib/mandate/types";
import type { HeadShaders } from "./shaders";
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        Agent visualization unavailable
        <br />
        <span>WebGL is required for the live portrait.</span>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function AgentParticleScene({
  state,
  shaders,
}: {
  state: MandateState;
  shaders: HeadShaders;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return (
    <div
      className="agent-scene"
      title="Drag or use arrow keys for a gentle turn (up to 4° each side). Home centers the view."
      tabIndex={0}
      role="img"
      aria-label={`Interactive 3D particle portrait. Drag or use arrow keys for a gentle turn, limited to four degrees each side; Home centers the view. AgentOS ${MANDATE_STATE[state].agent.toLowerCase()}.`}
    >
      <HudRings />
      {state === "boundary" && (
        <svg
          className="authority-orbit"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="43"
            fill="none"
            stroke="currentColor"
            strokeWidth=".18"
          />
          {!reducedMotion &&
            Array.from({ length: 12 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 30} 50 50)`}>
                <circle cx="50" cy="18" r=".28" fill="currentColor">
                  <animate
                    attributeName="cy"
                    from="18"
                    to="7"
                    dur="1.1s"
                    begin={`${i * 0.035}s`}
                    fill="freeze"
                  />
                </circle>
              </g>
            ))}
        </svg>
      )}
      <SceneBoundary>
        <Canvas
          style={{ mixBlendMode: "screen" }}
          onCreated={({ gl }) => {
            gl.toneMappingExposure = 1.0;
          }}
          camera={{ position: [0, 0, 6.1], fov: 32, near: 0.1, far: 50 }}
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          fallback={
            <div className="scene-fallback">
              WebGL is required for the live portrait.
            </div>
          }
        >
          <Suspense fallback={null}>
            <ParticlePortrait
              state={state}
              shaders={shaders}
              reducedMotion={reducedMotion}
            />
          </Suspense>
          <AmbientDust state={state} reducedMotion={reducedMotion} />
          <PortraitBloom />
        </Canvas>
      </SceneBoundary>
      <div className="agent-label">
        <span className="status-dot" />
        <div>
          <div className="eyebrow">AGENTOS · DEMO</div>
          <strong>{MANDATE_STATE[state].agent}</strong>
        </div>
      </div>
      <div className="agent-step">
        <div className="eyebrow">CURRENT STEP</div>
        <span>
          {state === "boundary"
            ? "Await Mandate amendment"
            : "Run verification suite"}
        </span>
      </div>
      <span className="particle-count">6,891 PARTICLES</span>
    </div>
  );
}
