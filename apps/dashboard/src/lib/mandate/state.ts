import type { MandateState } from "./types";
export const PARTICLE_STATE = {
  within: {
    primary: "#6FEFFF",
    secondary: "#2AAEC0",
    jitter: 0.004,
    dispersion: 0,
    pulseSpeed: 0.7,
    dustVelocity: 0.08,
    rotationResponse: 0.055,
  },
  attention: {
    primary: "#F3B34D",
    secondary: "#9B681F",
    jitter: 0.01,
    dispersion: 0.018,
    pulseSpeed: 1.15,
    dustVelocity: 0.035,
    rotationResponse: 0.07,
  },
  boundary: {
    primary: "#FF5B57",
    secondary: "#8E2B2A",
    jitter: 0.027,
    dispersion: 0.085,
    pulseSpeed: 1.8,
    dustVelocity: 0.008,
    rotationResponse: 0.09,
  },
} as const;
export function stateForStatus(status: string): MandateState {
  if (["SUSPENDED", "REVOKED", "EXPIRED", "REJECTED"].includes(status)) return "boundary";
  if (["DRAFT", "PROPOSED", "AWAITING_APPROVAL", "AMENDMENT_PENDING"].includes(status)) return "attention";
  return "within";
}

export function titleCase(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function clockTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(11, 19);
}

export const MANDATE_STATE: Record<
  MandateState,
  {
    authority: string;
    agent: string;
    execution: string;
    attention: string;
    body: string;
    health: string;
    detail: string;
  }
> = {
  within: {
    authority: "Within approved boundary",
    agent: "EXECUTING",
    execution: "Running",
    attention: "Nothing requires you",
    body: "AgentOS is executing inside the authority you approved. Routine activity stays quiet until intervention is necessary.",
    health: "Autonomy is healthy",
    detail: "No approvals, blockers or boundary exceptions.",
  },
  attention: {
    authority: "Review recommended",
    agent: "EXECUTING / REVIEW",
    execution: "Review advised",
    attention: "Review recommended",
    body: "A verification check needs a closer look. AgentOS may continue work within the authority you approved.",
    health: "Your review would help",
    detail: "Execution continues where permitted.",
  },
  boundary: {
    authority: "Boundary hit",
    agent: "PAUSED",
    execution: "Paused",
    attention: "Mandate amendment required",
    body: "The next action requests a database schema change, outside this Mandate. AgentOS has paused before execution.",
    health: "Database change blocked",
    detail: "Your approval is required to extend authority.",
  },
};
