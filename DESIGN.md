---
name: Mandate
description: A dark mission-control instrument for outcome-bound agent authority.
colors:
  void: "#05090c"
  authority-ink: "#f2f5f7"
  muted-ink: "#8a949e"
  dim-ink: "#64717d"
  panel: "#0b1115"
  panel-deep: "#080d13"
  quiet-border: "rgba(255, 255, 255, 0.085)"
  divider: "rgba(255, 255, 255, 0.065)"
  in-scope: "#6fefff"
  in-scope-deep: "#2aaec0"
  review: "#f3b34d"
  blocked: "#ff5b57"
  success: "#35df9b"
typography:
  display:
    fontFamily: "Inter Variable, Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.375rem, 3.7vw, 3.625rem)"
    fontWeight: 500
    lineHeight: 1.005
    letterSpacing: "-0.048em"
  headline:
    fontFamily: "Inter Variable, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Inter Variable, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, Arial, Helvetica, sans-serif"
    fontSize: "0.5625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.17em"
  evidence:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.5625rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  detail: "6px"
  control: "9px"
  group: "11px"
  panel: "16px"
  hero: "18px"
  pill: "999px"
spacing:
  hairline: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "26px"
  2xl: "32px"
components:
  button-control:
    backgroundColor: "transparent"
    textColor: "{colors.authority-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "33px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.authority-ink}"
    rounded: "{rounded.panel}"
    padding: "17px 23px"
  approval-chip:
    backgroundColor: "rgba(50, 95, 150, 0.05)"
    textColor: "#aecbff"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  nav-selected:
    backgroundColor: "rgba(255, 255, 255, 0.045)"
    textColor: "{colors.authority-ink}"
    rounded: "10px"
    padding: "0 12px"
    height: "40px"
---

# Design System: Mandate

## Overview

**Creative North Star: "The Living Authority Field"**

Mandate is a dark operational instrument for supervising autonomy under explicit limits. Its focal object is a procedurally assembled agent portrait whose color, coherence, and surrounding field change with authority state. The interface should feel observed and exact rather than theatrical: near-black space, quiet hairlines, compact data labels, and one luminous mechanism doing real work.

The visual world is optimized for a principal checking a consequential run under dim, focused working conditions. It is futuristic because the product mechanism is visible, not because generic neon chrome has been applied to ordinary cards.

**Key Characteristics:**
- A near-black mission-control field with sparse, hairline structure
- One dominant procedural particle portrait paired with the authority envelope
- Cyan for in-scope execution, amber for review, and red only for a blocked expansion
- Compact operational labels, plain-language decisions, and locally rendered evidence
- A single assembly-to-evidence motion sequence rather than scattered entrance effects

## Colors

The palette is restrained graphite with state colors used as emitted light. Most of the interface remains neutral so a change in authority is immediately legible.

### Primary
- **In-Scope Cyan:** The active particle field, current execution markers, focus outlines, and measured authority usage.
- **Deep Cyan:** Low-emphasis rings, borders, and ambient particle depth supporting the primary cyan.

### Secondary
- **Review Amber:** Human-attention review and the authority orbit around a blocked request.
- **Blocked Red:** Denied expansion, paused execution, and the dispersed boundary portrait only.
- **Evidence Green:** Reserved for independently verified completion records.

### Neutral
- **Void:** The page and fixed rail ground.
- **Authority Ink:** Primary text and decisive control labels.
- **Muted Ink:** Body explanations and secondary navigation.
- **Dim Ink:** Evidence metadata and inactive states.
- **Panel / Panel Deep:** Tonal layers inside broad operational surfaces.
- **Quiet Border / Divider:** One-pixel structure between regions and records.

**The State-Light Rule.** Color belongs to execution state. Neutral content does not borrow cyan, amber, red, or green for decoration.

**The Fail-Closed Red Rule.** Red means an attempted authority expansion was stopped before execution; routine review uses amber, and status always includes language.

## Typography

**Display Font:** Inter Variable (with Arial and Helvetica fallbacks)

**Body Font:** Inter Variable (with Arial and Helvetica fallbacks)

**Evidence Font:** The platform UI monospace stack

**Character:** Inter is deliberately quiet and compact so the animated authority mechanism remains the identity. Weight contrast is restrained; size, density, and spacing establish hierarchy.

### Hierarchy
- **Display** (500, responsive 38–58px, 1.005): The delegated outcome in the hero only.
- **Headline** (500, 18px, 1.16): Execution, attention, evidence, and demo-state headings.
- **Body** (400, 14px, 1.5): Mandate descriptions and governance explanations; keep long lines near 65–75 characters.
- **Operational label** (600, 9px, 0.17em tracking, uppercase): Actual fields such as authority, current step, and evidence category—not generic promotional kickers.
- **Evidence** (400, 9px, monospace): Timestamps, mandate identifiers, counters, and machine-shaped values.

**The Operational-Label Rule.** Small uppercase type names a real field or channel. Do not add an eyebrow merely to decorate a heading.

## Layout

The public `/` route is a guided explanatory surface. Its first viewport pairs a plain-language thesis with a six-stage authority simulator. Subsequent sections use broad ruled regions for the outcome/authority/plan distinction, enforcement gate, reference architecture, proof ledger, and honest limits. It has no dashboard rail and never inherits the authenticated shell's `main` offsets.

The authenticated `/dashboard` route uses a fixed 210px rail and a fluid main canvas with 26–32px outer padding. Its first surface is a two-column 480px hero: authority statement on the left, procedural portrait on the right. Execution and attention form the next row; evidence and demo controls close the dashboard.

The protected `/simulator` route is a two-column conversation instrument rather than a dashboard. Human outcome capture and simulated Alexa+ readback occupy the left side; the real MCP response and immutable authority summary occupy the right. A separate connection-truth ledger states which boundaries are live, simulated, externally blocked, or intentionally absent.

Below 1180px the public hero stacks; below 760px its stage controls scroll horizontally and proof regions become one column. At 1000px the authenticated hero becomes one column and the portrait receives its own 440px stage. The simulator stacks below 940px and condenses its transcript, envelope fields, and reference lookup below 660px. At 600px the dashboard rail becomes a 112px fixed header. Every route preserves decision and evidence fields rather than dropping information.

**The Mechanism-First Rule.** The mandate and living authority field share the first viewport; generic metrics never lead the page.

## Elevation & Depth

The system uses tonal depth, transparency, and one-pixel boundaries rather than stacked shadows. Panels shift from the Void into two close graphite values. Bloom belongs inside the particle render, and the modal alone receives a broad black shadow because it creates protected focus. State glows remain small and attached to particles or status points; they are not card decoration.

**The Contained-Light Rule.** Emitted light stays inside the portrait, a status point, or the active authority line. Broad surfaces remain matte.

## Shapes

Broad panels use 16px corners, the hero uses 18px, controls use 9px, and small evidence cells use 6px. Full pills are reserved for compact status or identity channels. Circular geometry belongs to the portrait HUD, status points, the Alexa+ outline, and bounded meters. Borders are always one pixel and low contrast; dashed borders identify a quiet health field, not a warning.

## Components

### Buttons
- **Shape:** Compact rounded rectangles (9px) with a one-pixel quiet border.
- **Default:** Transparent over the current surface with Authority Ink.
- **Hover / Focus:** A faint neutral fill on hover and a two-pixel In-Scope Cyan outline on keyboard focus.
- **Boundary action:** Keeps the same geometry and uses a low-opacity Blocked Red border; the action text names the authority consequence.

### Status Channels
- **Approval chip:** A 28px pill with a thin cool-blue outline and explicit “Demo” language until identity is authenticated.
- **Running badge:** A compact neutral pill pairing a state dot with text.
- **Authority meter:** A one-pixel track with a luminous active segment and a fixed terminal boundary mark; the adjacent label repeats the state in words.

### Panels
- **Corner style:** Broad 16px regions; 18px for the first-viewport hero.
- **Background:** A subtle two-tone graphite field over the Void.
- **Border:** One-pixel Quiet Border; nested information uses Divider rules instead of nested cards.
- **Padding:** 17–23px for operational panels and 47px around the desktop mandate statement.

### Navigation
- **Public desktop:** A compact top bar links to mechanism, architecture, proof, and the authenticated operator record.
- **Authenticated desktop:** A fixed matte rail with text destinations, tiny circular markers, and one tonal selected field.
- **Mobile:** A compact brand row sits above horizontal destinations; the operator record remains reachable.
- **State:** Selection is communicated by fill, text contrast, a state point, and `aria-current`.

### Particle Portrait

The signature component samples a bundled CC0 anatomical mesh with deterministic procedural coloring, custom vertex and fragment shaders, MIT-licensed noise, and post-processing bloom. No portrait photograph, likeness, or reference raster is loaded. It assembles once, accepts pointer and keyboard yaw within ±4°, shifts state without changing authority, and falls back to explanatory text when WebGL is unavailable. Reduced-motion mode disables assembly, drift, evidence trails, and decorative state animation while preserving the final portrait and all status language.

### Simulated Alexa+ Client

The protected fallback uses a speech-shaped outline only as a channel marker, never as proof of Amazon hosting. Its form captures an outcome—not authority fields—and its result panel renders only validated MCP output. Connection truth appears above the interaction; an amber rule repeats that the surface cannot approve or execute. Empty, unavailable, pending, waiting-for-review, active, and independently verified states remain textually distinct.

### Dialogs

Native modal dialogs hold the execution trace and authority delta. They use Panel Deep, a broad black focus shadow, Escape/backdrop dismissal, a named close control, and plain-language evidence. Demonstration status remains visible in the content.

## Do's and Don'ts

### Do:
- **Do** make the authority boundary and current execution state readable without interpreting the portrait color.
- **Do** preserve the portrait's ±4° interaction limit and reduced-motion behavior.
- **Do** present live-service state only when it comes from the authenticated server boundary; label the public simulation and explicit fixture mode as non-executing or illustrative.
- **Do** use local assets with attribution and embedded provenance.
- **Do** let one state transition carry the motion story, then keep the console quiet.
- **Do** label the fallback as simulated, not Amazon-hosted, and development-credential-backed next to the interaction itself.

### Don't:
- **Don't** use state colors for generic links, borders, or decorative emphasis.
- **Don't** turn supporting information into an equal-weight metric grid.
- **Don't** replace the procedural portrait with a static generic AI avatar or remote runtime asset.
- **Don't** use red for review, warning, or urgency when no authority expansion was actually blocked.
- **Don't** add promotional eyebrows; compact uppercase labels must identify a real operational field.
- **Don't** present fixture timestamps, approvals, evidence, or AgentOS/Alexa+ status as live.
- **Don't** let the public guided simulation execute tools or borrow the operator credential.
- **Don't** place approval, amendment, execution, deployment, or merge controls in the simulated Alexa+ client.
