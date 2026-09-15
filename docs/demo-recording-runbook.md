# Final demo recording runbook

This is the claim-locked capture plan for a public video of 2:50 or less. The default path is entirely read-only: it does not prepare, approve, execute, deploy, merge, or create a Mandate.

Use the exact narration in [`submission-package.md`](submission-package.md#demo-video-plan--250-maximum). This runbook governs what appears on screen.

## Output specification

- 1440 × 900 or 1920 × 1080, constant frame rate, H.264 video, AAC audio.
- Browser zoom at 100%; pointer visible; browser chrome cropped out if possible.
- Clear narration with no music, or only original/cleared music mixed below speech.
- Duration target: 2:42–2:47. Hard limit: 2:50.
- Public YouTube or Vimeo playback that works in a signed-out browser.

## Preflight before recording

1. Use the deployed commit documented in [`submission-assets.md`](submission-assets.md).
2. Open a clean browser profile with bookmarks, extensions, account names, and unrelated tabs hidden.
3. Authenticate to `/simulator` and `/dashboard` **before** capture begins. Never place a Basic-auth password in a URL or show the login dialog.
4. Pre-open these content-only tabs in order:
   - `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/`
   - `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/simulator`
   - `https://o2mjeuvaik.execute-api.us-east-1.amazonaws.com/dashboard`
5. Confirm `/simulator` says “SIMULATED ALEXA+ CLIENT,” “Live · server-only,” “Blocked externally,” and “Not exposed here.”
6. Confirm `/dashboard` shows `M-checkout-live-003` as `COMPLETED`.
7. Put `M-checkout-live-003` in the clipboard. The value is public proof metadata, not a credential.
8. Close password managers, terminals, AWS consoles, database tools, Keychain, notifications, and messaging apps.
9. Disable operating-system notifications and clock overlays. Check microphone level with a ten-second sample.
10. Keep [`assets/architecture.png`](assets/architecture.png) ready as the final editor insert; do not open a third-party repository UI during capture.

## Shot list

| Time | Picture | Operator action | Required visible proof |
| --- | --- | --- | --- |
| 0:00–0:16 | Public `/` first viewport | Hold, then start the guided run | “PUBLIC GUIDED SIMULATION · NO ACTIONS EXECUTED”; outcome/authority headline |
| 0:16–0:24 | Adapt | Select stage 2 | Code reading and tests fit the envelope |
| 0:24–0:34 | Block | Select stage 3 and hold | `DATABASE_SCHEMA_MUTATION`; red `DENY`; paused state |
| 0:34–0:42 | Replan | Select stage 4 | Repository-only replan without authority expansion |
| 0:42–1:12 | Protected `/simulator` | Switch tabs; do not press “Prepare bounded work” | Simulated-client label; real MCP connection ledger; absent account linking and approval |
| 1:12–1:34 | Existing-reference lookup | Paste `M-checkout-live-003`; select the read/status control | Live `COMPLETED` response; immutable envelope; no approval controls |
| 1:34–2:10 | Authenticated `/dashboard` | Switch tabs; hold on hero and governed execution | One governed action; zero model tokens; zero direct spend; completed state |
| 2:10–2:34 | Dashboard evidence area | Select Evidence or scroll to the evidence and audit record | Independent test/review identities; two independently verified records; sixteen-event valid chain |
| 2:34–2:50 | Architecture still | Cut to `assets/architecture.png`; slow hold | Alexa+ blocker, deployed simulator/MCP/control plane, separate human gate, independent completion, durable worker marked not deployed |

Prefer hard cuts over animated transitions. Leave each proof label stationary long enough to read.

## Safe interaction boundary

During the default recording:

- **Allowed:** public simulation controls, live status lookup for `M-checkout-live-003`, dashboard navigation, scrolling.
- **Forbidden without a new explicit authorization:** “Prepare bounded work,” approval, execution, deployment, merge, IAM, credential changes, or evidence mutation.
- Never use `M-checkout-live-002`; it is a placeholder-era record.
- Do not open private S3 evidence objects. The summarized count and independent verifier identities are sufficient.

If a preparation call is separately authorized immediately before capture, make exactly one call, retain its returned reference, show that it stops at `AWAITING_APPROVAL`, and do not proceed further. Do not substitute this optional take for the completed independent-evidence proof.

## Claim guardrails

Say:

- “simulated Alexa+ client”;
- “real MCP endpoint”;
- “prior completed live record”;
- “public AgentOS reference rehearsal”;
- “Alexa hosting and OAuth remain externally blocked”; and
- “durable dispatch is not yet deployed.”

Do not say:

- “live Alexa+ integration” or “Alexa-hosted”;
- “OAuth account linking is active”;
- “AgentCore is used”;
- “arbitrary autonomous execution is production-ready”;
- “the agent approved itself”; or
- “AgentOS evidence completed the Mandate.”

## Edit and export

1. Remove dead air, authentication setup, mistyped input, notifications, and failed takes.
2. Keep the public simulation label in frame whenever explaining simulated actions.
3. Add simple captions from the exact final narration; verify `AgentOS`, `MCP 2025-11-25`, `M-checkout-live-003`, and `Neon Postgres` manually.
4. Use the architecture PNG directly rather than screen-recording it.
5. End on the line “Delegate outcomes—not tool calls” and hold for one second.
6. Export once, then inspect the exported file rather than relying on the editor preview.

## Final acceptance gate

- [ ] Runtime is 2:50 or less.
- [ ] First 30 seconds establish the problem and show the product.
- [ ] The real MCP status lookup succeeds on screen.
- [ ] The completed proof visibly shows one governed action and independent verification.
- [ ] “Simulated Alexa+” and the Amazon-side blocker are stated both visually and verbally.
- [ ] No preparation or consequential operation occurred without separate authorization.
- [ ] No credential, authorization header, private URL, AWS account page, notification, or unrelated tab appears in any frame.
- [ ] No Amazon/Alexa logo, third-party logo, portrait photograph, unlicensed image, or copyrighted music appears.
- [ ] Captions match the spoken claims and contain no unsupported feature claim.
- [ ] The architecture frame leaves outbox/SQS and the durable worker visibly marked “NOT YET DEPLOYED.”
- [ ] Public playback works while signed out, seeking works, audio is intelligible, and 1080p/HD processing is complete.
- [ ] The final public URL is copied into Devpost and the project remains available through November 20, 2026.
