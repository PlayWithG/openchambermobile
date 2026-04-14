## Exploration: Android App for OpenChamber (S24 Ultra Optimized)

### Current State
OpenChamber consists of a monorepo with `packages/ui` (React, Zustand, Tailwind), `packages/web` (Express server), and `packages/desktop` (Tauri shell). The UI is already responsive with a `mobile.css` file handling touch interactions and layout adjustments for mobile.

### Affected Areas
- `packages/ui/src/styles/mobile.css` — Already contains mobile responsiveness.
- `packages/ui/src/lib/opencode/client.ts` — Likely needs updates for remote host connectivity on mobile.
- New package (e.g., `packages/mobile`) — Will be needed for the Android project configuration.

### Approaches
1. **Capacitor (Recommended)** — Wrap the existing web UI into a native Android container.
    - Pros: High reuse of existing `packages/ui` components; leverages existing mobile CSS; quick development cycle.
    - Cons: Might require custom plugins for very advanced device-specific features.
    - Effort: Low

2. **React Native / Expo** — Rebuild the UI using native components.
    - Pros: Excellent native performance; best access to specific Android APIs (S-Pen, display settings).
    - Cons: Significant re-write of `packages/ui` components required; risk of UI/logic divergence.
    - Effort: High

### Recommendation
Use **Capacitor**. The existing UI is already responsive for mobile, and Capacitor allows wrapping this into a native app with minimal disruption. The performance and S-Pen features on the Galaxy S24 Ultra are well-supported via standard web touch/pointer events, which Capacitor supports.

### Risks
- Mobile-specific performance bottlenecks in the UI (heavy rendering of chat/terminal components) could emerge.
- Advanced S-Pen features (e.g., hover states, pressure sensitivity) might need custom native plugins if standard browser events are insufficient.
- Remote server connectivity (SSE) might be interrupted by Android's aggressive backgrounding.

### Ready for Proposal
Yes. The orchestrator can tell the user that the exploration is complete, and that we recommend the Capacitor approach for rapid development and high code reuse, keeping the S24 Ultra optimization as a follow-up task if needed.
