---
name: Mandate
description: A calm authority console for governing consequential agent work.
colors:
  authority-ink: "#111820"
  workspace: "#f4f7f9"
  surface: "#ffffff"
  rail: "#121a24"
  rail-raised: "#202b38"
  secondary-ink: "#596778"
  border: "#d9e1e8"
  soft-field: "#eef3f6"
  attention: "#9a6100"
  attention-field: "#fff2d5"
  verified: "#079bc1"
  verified-field: "#dff8ff"
  success: "#21865d"
  destructive: "#b53b3b"
typography:
  display:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  evidence:
    fontFamily: "Geist Mono, Geist Mono Fallback, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "40px"
  4xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.authority-ink}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  card-decision:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.authority-ink}"
    rounded: "{rounded.xl}"
    padding: "32px"
  chip-attention:
    backgroundColor: "{colors.attention-field}"
    textColor: "{colors.attention}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
---

# Design System: Mandate

## Overview

**Creative North Star: "The Authority Console"**

Mandate is an operational control surface for understanding delegated authority and acting on exceptions. It pairs a dark graphite navigation rail with a cool, quiet workspace so the interface feels exact and durable without becoming a developer console.

The hierarchy gives authority deltas, boundaries, alternatives, and evidence more visual weight than product chrome. It is calm rather than alarming and administrative rather than futuristic; color is sparse enough that attention and verified identity remain unmistakable.

**Key Characteristics:**
- Dark persistent rail beside a cool reading field
- One dominant decision surface, followed by evidence and immutable scope
- Amber for blocked expansion; cyan for Alexa-backed identity
- Crisp borders, restrained ambient depth, and explicit plain-language actions

## Colors

The palette uses cool neutrals for sustained reading, a near-black rail for orientation, and two scarce semantic accents.

### Primary
- **Authority Ink:** Primary text, decisive controls, and high-contrast command surfaces.
- **Attention Amber:** Human attention, paused execution, and requested authority expansion only.

### Secondary
- **Verified Cyan:** Authenticated Alexa identity and verified control-plane presence only.
- **Success Green:** In-scope execution and successful evidence states.
- **Destructive Red:** Destructive or irreversible outcomes, not routine blocked expansion.

### Neutral
- **Cool Workspace:** The persistent page field.
- **Raised Surface:** Decision cards and structured scope cells.
- **Graphite Rail:** Navigation and the Alexa control band.
- **Raised Graphite:** Selected or hovered navigation states.
- **Secondary Ink:** Supporting copy and metadata.
- **Quiet Border:** Dividers, outlines, and table-like joins.
- **Soft Field:** Boundary summaries and low-emphasis grouping.

**The Semantic Scarcity Rule.** Amber never decorates; cyan never acts as a generic link color; status always includes language or iconography in addition to color.

## Typography

- **Display Font:** Geist (with UI sans-serif fallbacks)
- **Body Font:** Geist (with UI sans-serif fallbacks)
- **Label/Mono Font:** Geist Mono (with UI monospace fallbacks)

**Character:** Compact, neutral interface typography keeps dense authority information legible. Monospace is reserved for machine-shaped evidence rather than used as a technical costume.

### Hierarchy
- **Display** (600, responsive 30–36px, 1.2): Mandate titles only.
- **Headline** (600, responsive 24–30px, 1.25): The current consequential decision.
- **Title** (600, 20px, 1.4): Section headings and major supporting labels.
- **Body** (400, 16px, 1.5): Explanations and conversational prompts; prose stays near 72 characters where practical.
- **Label** (500, 14px, 1.4): Navigation, metadata, and controls.
- **Evidence** (400, 12px, 1.4): Versions, hashes, timestamps, identifiers, and machine evidence.

**The Evidence Type Rule.** Use monospace only when the underlying value is machine-shaped and benefits from character-level inspection.

## Layout

Desktop uses a fixed 272px navigation rail, a 64px top bar, and a fluid main workspace capped at 1480px. The mandate title and tabs establish the reading order; the decision surface leads a two-column area with a 290px immutable summary, followed by a full-width Alexa band, event row, and approved scope.

The spacing rhythm is based on 8px with frequent 16px, 24px, 32px, and 40px intervals. Below 1280px, the immutable summary moves beneath the decision. Below 1024px, the rail becomes a compact dark header. Below 640px, actions stack, tabs remain horizontally available, and structured pairs become vertical. No authority information disappears at narrow widths.

**The Decision-First Rule.** A consequential state and its available choices appear before history, evidence, or scope detail.

## Elevation & Depth

The system is flat by default and uses tonal layering and quiet borders for structure. Only the primary decision card receives a faint ambient shadow (`0 10px 30px rgba(17, 24, 32, 0.05)`), while the dark Alexa band receives a slightly stronger anchor shadow (`0 14px 34px rgba(18, 26, 36, 0.15)`). There are no colored glows.

**The One-Lift Rule.** Elevation identifies the active decision; routine rows and nested fields remain flat.

## Shapes

Surfaces use gently rounded geometry: 10px for controls, 14px for primary containers, and 999px only for compact status chips and identity rings. Borders remain one pixel and low contrast. Information inside a primary surface is grouped with tonal fields, separators, and shared-border cells rather than nested cards.

The open cyan ring is the recurring identity geometry for Alexa-backed approval and control. It is paired with text whenever its meaning matters.

## Components

### Buttons
- **Shape:** Direct rounded rectangles (10px) with a 48px action height on decision surfaces.
- **Primary:** Graphite fill, white text, and 24px horizontal padding.
- **Secondary:** Workspace fill, quiet border, and authority-ink text.
- **Hover / Focus:** Tonal darkening on hover; a visible cyan focus ring; a one-pixel press translation on active controls.

### Chips
- **Style:** Compact semantic field with a full pill radius; attention chips use amber field and ink.
- **State:** Always pair icon and short text so color does not carry status alone.

### Cards / Containers
- **Corner Style:** Gently rounded primary containers (14px) and structured inner fields (10px).
- **Background:** White on the cool workspace; graphite for the Alexa control band.
- **Shadow Strategy:** One lifted decision card; supporting structures stay flat.
- **Border:** Quiet one-pixel border.
- **Internal Padding:** 20px on mobile and 32px from small screens upward.

### Navigation
- **Style:** Low-chrome text links with Lucide line icons. Selected rail items use a raised graphite field; selected tabs use a two-pixel ink underline.
- **Responsive treatment:** The full rail is replaced by a compact branded header below 1024px rather than squeezed into the viewport.

### Attention Surface
- **Content:** Pause state, plain-language boundary explanation, current envelope, and two explicit choices.
- **Behavior:** Reviewing an amendment expands exact effect and risk deltas in place; choosing a compliant alternative never changes approved scope.

### Alexa Control Band
- **Style:** High-contrast graphite band, verified cyan ring, explicit Alexa+ name, and a visible illustrative/live qualifier.
- **Motion:** The ring may pulse once when attention first appears; reduced-motion users receive no pulse and all information remains visible.

## Do's and Don'ts

### Do:
- **Do** put the current authority boundary next to the decision it governs.
- **Do** name the exact authority delta and a compliant alternative before asking for approval.
- **Do** keep interaction targets at least 44px and retain visible keyboard focus.
- **Do** use native landmarks, headings, buttons, links, and `aria-current` for active navigation.
- **Do** keep approved scope visually stable while an amendment is reviewed or rejected.

### Don't:
- **Don't** use generic warning banners without a next action.
- **Don't** use gradients, glass effects, neon glows, or decorative charts.
- **Don't** create equal-weight dashboard card grids or nest cards inside cards.
- **Don't** use red for routine blocked authority expansion.
- **Don't** hide authority changes behind ambiguous confirmation language or narrow viewports.
