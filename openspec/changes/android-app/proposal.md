# Proposal: OpenChamber Android App (S24 Ultra Optimized)

## Intent

Deliver a native Android application for OpenChamber optimized for the Galaxy S24 Ultra that connects to a remote PC running an OpenCode server. The core work is **not** porting the UI — it's making the mobile connectivity layer robust enough to feel native and reliable on a phone.

**Why Capacitor, not React Native:** OpenChamber already has a functional web UI, mobile-specific styles (`mobile.css`), and tightly coupled frontend logic. Rewriting that in React Native creates two clients for the same product, which forks velocity, visual consistency, and maintenance burden. Capacitor wraps the shared UI as the single source of truth, delivering to mobile without bifurcating the product. This is a strategic choice, not a convenience shortcut — it would only make sense to choose React Native if the mobile UX needed to be fundamentally different from the web, required deep offline support, or demanded native-only UI performance. None of those apply here.

## Scope

### In Scope

1. **Capacitor Android wrapper** (`packages/mobile`) — wrap the existing React UI (`packages/ui`) as a native Android application with proper Capacitor configuration and build pipeline.
2. **Connectivity management module** — a dedicated client-side module that handles the full spectrum of mobile connectivity challenges:
   - App foreground/background lifecycle transitions
   - Network type changes (Wi-Fi ↔ mobile data)
   - Temporary tunnel or remote server loss
   - Retry with exponential backoff
   - Visible connection state in the UI: connected / reconnecting / disconnected
3. **Authentication & session persistence** — store and restore credentials, remote endpoint URL, and session state cleanly so that any disruption (background, network change, app restart) does not require manual reconfiguration.
4. **S24 Ultra hardware compatibility** — support S-Pen and high-refresh-rate interactions via standard web pointer events (no custom native plugins required).
5. **Mobile layout responsiveness** — leverage and extend existing `mobile.css` for the S24 Ultra's screen characteristics (6.8", 1440p, 19.5:9 aspect ratio).

### Out of Scope (deferred)

- Custom native Android plugins for advanced S-Pen features (e.g., hover previews, pressure sensitivity APIs).
- Offline capabilities (the app requires an active connection to a remote OpenCode server).
- iOS application distribution.
- Push notifications (future consideration after MVP).

## Capabilities

### New Capabilities

- `mobile-app`: Native Android application wrapper, Capacitor configuration, build pipeline, and Android-specific permissions/config.
- `connectivity-manager`: Client-side module responsible for detecting, managing, and recovering from connectivity state changes on mobile. Exposes a reactive connection state that the UI consumes.

### Modified Capabilities

- `remote-connection`: Update connection logic in `opencode/client.ts` to integrate with the connectivity manager, supporting mobile background states, network transitions, and automatic reconnection.
- `session-persistence`: Update session/auth logic to persist and restore credentials, remote endpoint, and session state across disruptions.

## Approach

### Phase 1 — Capacitor wrapper + connectivity core (MVP)

1. Add `packages/mobile` as a new monorepo workspace with Capacitor CLI scaffolding.
2. Build the **connectivity manager** module that:
   - Listens to Capacitor's `App` plugin for foreground/background events.
   - Listens to Capacitor's `Network` plugin for connectivity changes.
   - Manages SSE connection lifecycle: connect → stream → detect disconnect → reconnect with backoff.
   - Exposes a reactive `connectionState` store (Zustand) that the UI consumes for status indicators.
3. Wire `opencode/client.ts` to use the connectivity manager instead of raw SSE on mobile.
4. Implement **session persistence**: store server endpoint URL, auth tokens, and active session ID in Capacitor's Preferences API. On app resume, restore state and reconnect automatically.
5. Verify the MVP priority criteria:
   1. ✅ Open the app and connect to an existing remote server.
   2. ✅ Maintain a usable session in foreground.
   3. ✅ Recover cleanly after background or network change.
   4. ✅ Feel comfortable on a large screen (S24 Ultra).

### Phase 2 — Polish & optimization

- S24 Ultra layout fine-tuning (screen dimensions, touch targets, typography scale).
- S-Pen interaction validation.
- Performance profiling for terminal and chat under streaming.
- Android app signing and distribution setup.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/mobile/` | New | Capacitor project, Android native wrapper, build config |
| `packages/ui/src/lib/opencode/client.ts` | Modified | Integrate with connectivity manager for mobile lifecycle |
| `packages/ui/src/lib/opencode/connectivity.ts` | New | Connectivity manager module — network, background, reconnect |
| `packages/ui/src/lib/opencode/session-persistence.ts` | New | Session/auth persistence using Capacitor Preferences |
| `packages/ui/src/stores/` | New | Zustand store for reactive connection state |
| `packages/ui/src/styles/mobile.css` | Modified | S24 Ultra-specific layout adjustments |
| `packages/ui/src/components/` | New | Connection status indicator component |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE tunnel dies in background | High | High | Connectivity manager with lifecycle-aware reconnect + visible UI state |
| Network transition drops session | Medium | High | Automatic retry with backoff + session restoration from persistent storage |
| Zombie sessions after reconnect | Medium | High | Validate session liveness on resume; discard stale state before reconnecting |
| DOM performance (terminal/chat) | Medium | Medium | Lazy load history; profile and optimize hot paths on mobile |
| Android WebView quirks | Low | Medium | Test on real S24 Ultra; progressive enhancement |

## Rollback Plan

1. Remove the `packages/mobile` workspace from the monorepo.
2. Revert changes in `packages/ui/src/lib/opencode/client.ts`.
3. Remove new modules (`connectivity.ts`, `session-persistence.ts`, connection store) from `packages/ui`.
4. No data loss risk — all new modules are additive.

## Dependencies

- **Capacitor CLI** and core plugins (`@capacitor/app`, `@capacitor/network`, `@capacitor/preferences`).
- **Android SDK** (API 34+, targeting S24 Ultra).
- **Remote OpenCode server** accessible via HTTP+SSE from the mobile device (same network or tunnel).

## Success Criteria

### MVP (Phase 1)

- [ ] Android APK builds successfully from the monorepo.
- [ ] App connects to a remote OpenCode server and streams chat/tool data via SSE.
- [ ] Connection state is visible in the UI (connected / reconnecting / disconnected).
- [ ] App recovers cleanly after being sent to background and resumed.
- [ ] App recovers cleanly after a Wi-Fi ↔ mobile data transition.
- [ ] Session restores without manual reconfiguration after app restart.
- [ ] UI is responsive and comfortably usable on Galaxy S24 Ultra (6.8", 1440p, 19.5:9).

### Polish (Phase 2)

- [ ] S-Pen works naturally with the touch/pointer interface.
- [ ] Terminal and chat perform smoothly under streaming (60fps target).
- [ ] App is signed and ready for distribution (APK/AAB).