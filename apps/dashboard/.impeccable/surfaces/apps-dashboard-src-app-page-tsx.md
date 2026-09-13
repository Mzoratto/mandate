---
version: 1
slug: "apps-dashboard-src-app-page-tsx"
primary_target: "apps/dashboard/src/app/page.tsx"
related_targets: ["apps/dashboard/src/app/globals.css","apps/dashboard/src/app/layout.tsx"]
---

# Mandate detail dashboard

## Scope and mode

- Target: `apps/dashboard/src/app/page.tsx`
- Mode: Operate
- Audience: a principal reviewing an autonomous agent that needs attention
- Job: understand why execution paused, inspect the existing envelope, and choose rejection/compliant replanning or amendment review
- Primary action: ask the agent to find another solution without expanding authority
- Proof: current Mandate version, approval source, boundary summary, latest denied effect, and evidence status
- Constraint: all displayed records are clearly labeled illustrative until backed by the live control plane

## Direction contract

**THESIS:** Make the authority boundary the dominant working object, not another dashboard metric grid. The page refuses generic danger banners and asks one precise governance question.

**OWN-WORLD:** Follow the supplied reference: dark graphite navigation rail, cool-white workspace, ink typography, thin steel borders, amber attention, and cyan only for Alexa-backed identity. Surfaces are broad, quiet, and lightly raised.

**STORY:** The principal sees that AgentOS stopped safely, understands the database effect was outside the approved envelope, and can preserve that envelope or inspect a structured amendment.

**FIRST VIEWPORT:** A persistent rail and compact breadcrumb frame a large mandate title. The pause decision occupies the main column, immutable mandate facts sit beside it, and a dark Alexa control band plus latest event close the viewport. The compliant-replan action leads.

**FORM:** User-pinned operational reference, first and final structural direction. Seed key: `user-reference-2026-09-13`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

A restrained cyan Alexa ring and amber pause marker make it immediately clear that identity is verified while authority expansion remains blocked.

## Unresolved decisions

Live Alexa deep-link behavior and authenticated account identity remain unavailable; their controls must be labeled illustrative or disabled rather than simulated as connected.
