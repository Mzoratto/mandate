"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { HeadShaders } from "@/components/agent/shaders";
import type { MandateState } from "@/lib/mandate/types";

const AgentParticleScene = dynamic(() => import("@/components/agent/AgentParticleScene"), {
  ssr: false,
  loading: () => <div className="demo-portrait-loading">Assembling governed agent field…</div>,
});

const stages: Array<{
  short: string;
  title: string;
  explanation: string;
  plan: string;
  effect: string;
  decision: string;
  state: MandateState;
  agentStatus: string;
  verified?: boolean;
}> = [
  {
    short: "Delegate",
    title: "A human delegates the outcome—not a fixed plan.",
    explanation: "The Mandate names the result, agent, resources, effects, budgets, assumptions, and evidence required for completion.",
    plan: "No execution plan yet",
    effect: "None",
    decision: "HUMAN APPROVAL",
    state: "attention",
    agentStatus: "AWAITING MANDATE",
  },
  {
    short: "Adapt",
    title: "The agent chooses its first plan inside the envelope.",
    explanation: "Reading checkout code and running local tests fit the approved effects and repository paths. No new human decision is needed.",
    plan: "Inspect checkout → run tests",
    effect: "CODE_READ · LOCAL_COMMAND_EXECUTION",
    decision: "ALLOW",
    state: "within",
    agentStatus: "EXECUTING",
  },
  {
    short: "Block",
    title: "A forbidden database change stops at the boundary.",
    explanation: "Deterministic denial wins before execution. Possessing an agent credential cannot turn this into human approval.",
    plan: "Add column → migrate production schema",
    effect: "DATABASE_SCHEMA_MUTATION",
    decision: "DENY",
    state: "boundary",
    agentStatus: "PAUSED",
  },
  {
    short: "Replan",
    title: "The plan changes. The authority does not.",
    explanation: "The agent finds a repository-only repair that satisfies the same outcome without expanding effects, paths, or budget.",
    plan: "Patch total.js → rerun tests",
    effect: "CODE_MODIFICATION · TEST_EXECUTION",
    decision: "ALLOW",
    state: "within",
    agentStatus: "REPLANNING",
  },
  {
    short: "Approve action",
    title: "The exact mutation crosses a separate human gate.",
    explanation: "Mandate authorization permits the action to reach AgentOS approval; it never bypasses the checksum-bound acceptance ceremony.",
    plan: "Apply reviewed one-line repair",
    effect: "sha256:06cb8b3c…31212",
    decision: "CHECKSUM ACCEPTED",
    state: "attention",
    agentStatus: "HUMAN GATE",
  },
  {
    short: "Verify",
    title: "Independent evidence—not the agent—closes the outcome.",
    explanation: "Separate test and review identities bind immutable evidence digests. Only then do the execution and Mandate become complete.",
    plan: "3 tests pass → independent review passes",
    effect: "2 VERIFIED RECORDS · 16 LEDGER EVENTS",
    decision: "COMPLETED",
    state: "within",
    agentStatus: "COMPLETED",
    verified: true,
  },
];

const architecture = [
  ["Principal", "Approves outcome + amendments", "PROVEN"],
  ["Mandate", "Immutable authority envelope", "IMPLEMENTED"],
  ["AgentOS", "Intercepts the governed action", "REHEARSAL"],
  ["AWS control plane", "Authorizes + accounts + logs", "LIVE"],
  ["Neon ledger", "Persists state + event chain", "LIVE"],
  ["Independent verifiers", "Own completion criteria", "PROVEN"],
];

export default function PublicDemo({ shaders }: { shaders: HeadShaders }) {
  const [stage, setStage] = useState(0);
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const current = stages[stage]!;
  const advance = () => {
    setAmendmentOpen(false);
    setStage((value) => Math.min(stages.length - 1, value + 1));
  };

  return (
    <div className={`public-demo demo-state-${current.state}${current.verified ? " demo-verified" : ""}`}>
      <header className="demo-header">
        <a className="demo-brand" href="#top" aria-label="Mandate demo home">
          <span>M</span><strong>MANDATE<small>OUTCOME-BOUND AUTHORITY</small></strong>
        </a>
        <nav aria-label="Demo sections">
          <a href="#how">How it works</a>
          <a href="#architecture">Architecture</a>
          <a href="#proof">Proof</a>
        </nav>
        <a className="demo-operator-link" href="/dashboard">Operator record</a>
      </header>

      <main id="top">
        <section className="demo-hero" aria-labelledby="demo-title">
          <div className="demo-intro">
            <div className="demo-channel"><i /> PUBLIC GUIDED SIMULATION · NO ACTIONS EXECUTED</div>
            <h1 id="demo-title">Delegate outcomes,<br />not tool calls.</h1>
            <p className="demo-lede">Give an agent room to change its plan without giving it room to change its authority.</p>
            <blockquote>“The agent was free to change its plan. It was never free to change its authority.”</blockquote>
            <div className="demo-intro-actions">
              <button onClick={() => { setStage(1); document.querySelector(".demo-simulator")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Start the guided run</button>
              <a href="#concept">Understand the idea first</a>
            </div>
            <dl className="demo-promise">
              <div><dt>PLAN</dt><dd>Adaptive</dd></div>
              <div><dt>AUTHORITY</dt><dd>Immutable</dd></div>
              <div><dt>COMPLETION</dt><dd>Independently verified</dd></div>
            </dl>
          </div>

          <div className="demo-simulator" aria-label="Interactive governed execution simulation">
            <div className="sim-envelope">
              <div><span>APPROVED AUTHORITY</span><strong>Repository-local checkout repair</strong></div>
              <code>sha256:2863afab…203</code>
            </div>
            <div className="sim-body">
              <div className="sim-decision" aria-live="polite">
                <div className="sim-stage-label">STAGE {stage + 1} OF {stages.length} · {current.short.toUpperCase()}</div>
                <h2>{current.title}</h2>
                <p>{current.explanation}</p>
                <dl>
                  <div><dt>CHANGING PLAN</dt><dd>{current.plan}</dd></div>
                  <div><dt>PROPOSED EFFECT</dt><dd>{current.effect}</dd></div>
                  <div><dt>ENFORCEMENT DECISION</dt><dd className="sim-verdict">{current.decision}</dd></div>
                </dl>
                {stage === 2 && (
                  <div className="sim-boundary-actions">
                    <button onClick={advance}>Keep authority · replan</button>
                    <button className="secondary" aria-expanded={amendmentOpen} onClick={() => setAmendmentOpen((value) => !value)}>Inspect amendment path</button>
                  </div>
                )}
                {amendmentOpen && (
                  <div className="sim-amendment">
                    <strong>Authority cannot self-expand.</strong>
                    <p>A protected change creates a new immutable version and stale approval. Only an eligible principal can approve its exact digest.</p>
                  </div>
                )}
              </div>
              <div className="demo-portrait">
                <AgentParticleScene state={current.state} shaders={shaders} agentLabel="AGENTOS · SIMULATION" agentStatus={current.agentStatus} step={current.short} />
              </div>
            </div>
            <div className="sim-controls">
              <div className="sim-stage-nav" aria-label="Simulation stages">
                {stages.map((item, index) => (
                  <button key={item.short} aria-current={index === stage ? "step" : undefined} aria-label={`Stage ${index + 1}: ${item.short}`} onClick={() => { setStage(index); setAmendmentOpen(false); }}><span>{index + 1}</span>{item.short}</button>
                ))}
              </div>
              <button className="sim-next" onClick={stage === stages.length - 1 ? () => setStage(0) : advance}>{stage === stages.length - 1 ? "Replay demo" : `Next · ${stages[stage + 1]!.short}`}</button>
            </div>
          </div>
        </section>

        <section className="concept-section" id="concept" aria-labelledby="concept-title">
          <div className="section-heading">
            <h2 id="concept-title">One delegation. Three different things.</h2>
            <p>Most systems blur these layers together. Mandate keeps them separate so adaptation stays useful and authority stays bounded.</p>
          </div>
          <div className="concept-layers">
            <article><span>01</span><div><h3>Outcome</h3><p>What the human wants accomplished.</p></div><strong>Restore the checkout test suite</strong></article>
            <article><span>02</span><div><h3>Authority</h3><p>What effects, resources, budgets, and risks are permitted.</p></div><strong>Fixed after approval</strong></article>
            <article className="layer-adaptive"><span>03</span><div><h3>Plan</h3><p>How the agent tries to reach the outcome.</p></div><strong>May change autonomously</strong></article>
          </div>
        </section>

        <section className="mechanism-section" id="how" aria-labelledby="mechanism-title">
          <div className="section-heading">
            <h2 id="mechanism-title">Every consequential effect meets the same gate.</h2>
          </div>
          <div className="gate-sequence">
            <div className="gate-input"><small>AGENT PROPOSES</small><strong>Tool call + normalized effects</strong><code>CODE_MODIFICATION</code></div>
            <div className="gate-engine"><span className="gate-pulse" /><small>MANDATE GATE</small><strong>Identity · scope · effect · budget · assumptions</strong><em>Forbid wins</em></div>
            <div className="gate-outcomes">
              <div><i className="allow-dot" /><span><small>ALLOW</small><strong>May reach the next required gate</strong></span></div>
              <div><i className="deny-dot" /><span><small>DENY</small><strong>Stops before execution</strong></span></div>
              <div><i className="review-dot" /><span><small>ESCALATE</small><strong>Requires a new human decision</strong></span></div>
            </div>
          </div>
          <p className="mechanism-note">A Mandate approval, an individual action acceptance, and publishing the result are three separate authority ceremonies.</p>
        </section>

        <section className="architecture-section" id="architecture" aria-labelledby="architecture-title">
          <div className="section-heading">
            <h2 id="architecture-title">The protocol sits between human intent and machine effects.</h2>
            <p>Mandate is portable TypeScript. The checkout proof connects it to real enforcement, persistence, observability, and independent verification.</p>
          </div>
          <ol className="architecture-flow">
            {architecture.map(([name, detail, status], index) => (
              <li key={name}><span className="architecture-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{name}</h3><p>{detail}</p></div><strong>{status}</strong></li>
            ))}
          </ol>
          <div className="future-boundaries">
            <div><span>ALEXA+</span><strong>Reference human interface</strong><em>NOT CONNECTED</em></div>
            <div><span>AGENTCORE POLICY</span><strong>Intended policy enforcement</strong><em>NOT CONNECTED</em></div>
          </div>
        </section>

        <section className="proof-section" id="proof" aria-labelledby="proof-title">
          <div className="section-heading">
            <h2 id="proof-title">The demonstration ends in evidence you can inspect.</h2>
            <p>This is the actual completed run—not the interactive simulation above.</p>
          </div>
          <div className="proof-ledger">
            <div className="proof-summary">
              <span>MANDATE M-CHECKOUT-LIVE-003</span>
              <h3>One governed mutation. Zero model tokens. Two independent verifiers.</h3>
              <p>The reviewed one-line repair passed all three checkout tests and was merged without production, database, or secret-write authority.</p>
              <a href="https://github.com/Mzoratto/checkout-demo/pull/1" target="_blank" rel="noreferrer">Inspect merged checkout PR</a>
            </div>
            <dl>
              <div><dt>MANDATE DIGEST</dt><dd>sha256:2863afaba756…203</dd></div>
              <div><dt>ACTION CHECKSUM</dt><dd>sha256:06cb8b3c2ced…212</dd></div>
              <div><dt>PATCH DIGEST</dt><dd>sha256:8a95c82e1e94…ed13</dd></div>
              <div><dt>TEST EVIDENCE</dt><dd>sha256:cd9b128b285f…d8ca</dd></div>
              <div><dt>REVIEW EVIDENCE</dt><dd>sha256:ef2b86d13839…fd5</dd></div>
              <div><dt>EVENT LEDGER</dt><dd>16 hash-chained events</dd></div>
            </dl>
          </div>
          <div className="proof-links">
            <a href="https://github.com/Mzoratto/mandate" target="_blank" rel="noreferrer"><span>SOURCE</span>Read the protocol and implementation</a>
            <a href="https://github.com/Mzoratto/mandate/actions/runs/34813074224" target="_blank" rel="noreferrer"><span>DEPLOYMENT</span>Inspect the hardened AWS run</a>
            <a href="/dashboard"><span>AUTHENTICATED</span>Open the operator record</a>
          </div>
        </section>

        <section className="limits-section" aria-labelledby="limits-title">
          <div className="section-heading">
            <h2 id="limits-title">What this proves—and what it does not.</h2>
          </div>
          <div className="limits-columns">
            <div><h3>Proven now</h3><ul><li>Immutable, digest-bound authority</li><li>Fail-closed action authorization</li><li>Separate human action approval</li><li>Trusted zero-usage accounting</li><li>Independent evidence-gated completion</li><li>Authenticated Neon + AWS persistence</li></ul></div>
            <div><h3>Not claimed yet</h3><ul><li>Universal autonomous shell interception</li><li>Generic production deployment authority</li><li>Live Alexa+ identity integration</li><li>Live AgentCore Policy enforcement</li><li>Multi-user principal sessions</li><li>Enterprise policy administration</li></ul></div>
          </div>
        </section>

        <section className="demo-close">
          <p>Plans can change in milliseconds.<br />Authority changes still belong to people.</p>
          <div><a href="#top">Replay the guided demo</a><a href="https://github.com/Mzoratto/mandate" target="_blank" rel="noreferrer">Build with Mandate</a></div>
        </section>
      </main>
      <footer className="demo-footer"><span>MANDATE · APACHE-2.0</span><nav aria-label="Policy links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav><span>Outcome-bound authority for autonomous agents</span></footer>
    </div>
  );
}
