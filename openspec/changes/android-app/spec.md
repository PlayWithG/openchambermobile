# Specification: OpenChamber Android App (Delta)

## Overview

This specification defines the requirements for delivering a native Android application for OpenChamber, optimized for the Samsung Galaxy S24 Ultra, that connects to a remote PC running an OpenCode server. The core work is the **mobile connectivity layer**, not the UI wrapper.

**Reference device:** Samsung Galaxy S24 Ultra — 6.8" Dynamic AMOLED, 3120×1440 (19.5:9), 120Hz refresh rate, S-Pen support.

**Convention:** RFC 2119 keywords (MUST, SHALL, SHOULD, MAY) indicate requirement strength throughout this document.

---

## REQ-01: Capacitor Android Wrapper

### Requirement

Create a new `packages/mobile` workspace in the monorepo that wraps the existing `packages/ui` React application as a native Android app using Capacitor. This workspace MUST NOT duplicate or fork the UI; it SHALL reference the shared build output from `packages/ui`.

### Scenarios

**SC-01a: Build Android APK from monorepo**
- GIVEN the monorepo is cloned and dependencies are installed (`bun install`)
- WHEN `bun run build` is executed from the repository root
- THEN `packages/mobile` is built as part of the workspace pipeline
- AND an Android APK is produced under `packages/mobile/android/app/build/outputs/apk/`
- AND the APK launches on an Android device (API 34+) and loads the OpenChamber web UI without errors

**SC-01b: Capacitor sync reflects UI changes**
- GIVEN a change is made to the shared UI in `packages/ui`
- WHEN the UI is rebuilt (`bun run build` in `packages/ui`) and `npx cap sync` is run from `packages/mobile`
- THEN the Android project reflects the latest built web assets
- AND the app renders the updated UI on next launch

**SC-01c: Monorepo validation passes**
- GIVEN the mobile workspace is added to the monorepo
- WHEN `bun run type-check` and `bun run lint` are run from the repository root
- THEN both commands pass without errors
- AND `packages/mobile` contributes no new type-check or lint violations

**SC-01d: Runtime platform detection**
- GIVEN the app runs inside a Capacitor Android WebView
- WHEN the UI initializes
- THEN it SHALL detect the mobile runtime (via Capacitor platform API or `window.Capacitor`)
- AND apply `mobile-pointer` CSS class and `device-mobile` class as appropriate
- AND the existing `mobile.css` rules activate without manual intervention

### Acceptance Criteria

- [ ] New `packages/mobile` workspace exists with Capacitor CLI scaffolding
- [ ] `capacitor.config.ts` points webDir to `packages/ui` build output (e.g., `../ui/dist`)
- [ ] Android project targets API 34+ (Android 14)
- [ ] APK launches and renders the OpenChamber UI on a real or emulated Android device
- [ ] Workspace integrates with monorepo `bun run build`, `type-check`, `lint`
- [ ] Platform detection applies existing `mobile.css` rules at runtime on Android

---

## REQ-02: Connectivity Manager Module

### Requirement

Implement a dedicated `ConnectivityManager` module in `packages/ui/src/lib/opencode/` that manages the full lifecycle of the SSE connection on mobile. This module MUST integrate with (not duplicate) the existing `event-pipeline.ts` SSE loop. It SHALL handle foreground/background transitions, network type changes, remote server loss, and reconnection with exponential backoff. The manager MUST expose a reactive Zustand store (`useConnectionStore`) that the UI consumes for connection status indicators.

**Key integration point:** The existing `event-pipeline.ts` already handles SSE connection, coalescing, heartbeat timeout (15s), and visibility-triggered reconnection. The `ConnectivityManager` MUST layer on top of this — providing mobile-specific lifecycle awareness (Capacitor `App` and `Network` plugins) that the web-only event-pipeline cannot handle. The connectivity manager SHALL NOT re-implement SSE streaming; it MUST coordinate with the event pipeline's reconnect hook (`onReconnect` callback).

### Scenarios

**SC-02a: App goes to background while SSE is active**
- GIVEN the app is in foreground with an active SSE connection via event-pipeline
- WHEN the user switches to another app (home button / app switcher)
- THEN the Capacitor `App` plugin fires a `appStateChange` event with state `background`
- AND the connectivity manager transitions `connectionState` to `paused`
- AND the event-pipeline's existing heartbeat/visibility logic is NOT interfered with
- AND no zombie SSE connection resources are left consuming battery

**SC-02b: App returns to foreground from background**
- GIVEN the app was in background and `connectionState` is `paused`
- WHEN the user brings the app back to foreground
- THEN the Capacitor `App` plugin fires a `appStateChange` event with state `active`
- AND the connectivity manager MUST validate the previous session's liveness BEFORE restoring the SSE stream
- IF a liveness check (e.g., `GET /api/health` or equivalent endpoint) succeeds → transition to `connected` and resume SSE streaming
- IF the liveness check fails → discard stale session state, transition to `reconnecting`, and attempt reconnection
- AND the connection state SHALL transition to `connected` within 5 seconds under normal network conditions

**SC-02c: Network transition Wi-Fi → mobile data (or vice versa)**
- GIVEN the app has an active SSE connection over Wi-Fi
- WHEN the device switches network types (Wi-Fi → mobile data, or the reverse)
- THEN the Capacitor `Network` plugin fires a `networkStatusChange` event
- AND the connectivity manager detects the network change
- AND the SSE connection is terminated and re-established on the new network within 5 seconds
- AND no data that was already received is lost (no duplicate messages on reconnect)
- AND `connectionState` transitions through `reconnecting` → `connected`

**SC-02d: Remote server or tunnel becomes unreachable**
- GIVEN the app has an active SSE connection
- WHEN the remote OpenCode server becomes unreachable (network partition, server crash, tunnel expiry)
- THEN the connectivity manager detects the connection failure via SSE stream error or failed liveness check
- AND retries with exponential backoff starting at 1 second, doubling each attempt, capped at 30 seconds
- AND `connectionState` is set to `reconnecting` with a visible indicator
- AND when the server becomes reachable again, the connection is restored automatically
- AND retry attempts do NOT accumulate during background — they MUST be throttled to the cap interval

**SC-02e: Connection state is visible in UI**
- GIVEN any connectivity event occurs (connect, disconnect, reconnect, background, network change)
- WHEN the `useConnectionStore` Zustand store updates
- THEN the UI reflects the current state via the `ConnectionStatusBar` component:
  - `connected` → green indicator, no action needed
  - `reconnecting` → amber indicator with "Reconnecting..." text
  - `disconnected` → red indicator with "Disconnected" text and a "Retry" action
  - `paused` → (background state, not rendered in UI since app is hidden)

**SC-02f: Session liveness validation on resume**
- GIVEN the app resumes from background
- WHEN the connectivity manager attempts to reconnect
- THEN it SHALL send a liveness check request to the server BEFORE attempting to restore the SSE stream
- IF the server responds successfully → restore the existing session and SSE stream
- IF the server does not respond or responds with an error → discard stale session state and create a new connection
- AND session persistence (REQ-03) credentials are used for the new connection
- AND zombie sessions from before background are NOT re-used

**SC-02g: Event pipeline integration contract**
- GIVEN the connectivity manager and event-pipeline coexist
- WHEN the connectivity manager detects a mobile-specific lifecycle event (background/foreground, network change)
- THEN it SHALL coordinate with the event-pipeline's existing `onReconnect` callback
- AND SHALL NOT start a parallel SSE stream — it relies on event-pipeline for the actual SSE transport
- AND mobile-only lifecycle awareness (Capacitor plugins) is the connectivity manager's exclusive responsibility

### Acceptance Criteria

- [ ] `packages/ui/src/lib/opencode/connectivity.ts` module exists with `ConnectivityManager` class
- [ ] `ConnectivityManager` listens to Capacitor `App` plugin state changes (foreground/background)
- [ ] `ConnectivityManager` listens to Capacitor `Network` plugin for connectivity changes
- [ ] Capacitor listeners are ONLY registered when running on the Capacitor platform (no-op on web/desktop/VS Code)
- [ ] Exponential backoff: starts at 1s, doubles per attempt, caps at 30s, with jitter to prevent thundering herd
- [ ] Zustand store `useConnectionStore` with states: `connected`, `reconnecting`, `disconnected`, `paused`
- [ ] Store follows existing Zustand patterns: leaf selectors, no broad subscriptions, preserved references for unchanged fields
- [ ] Liveness validation on resume prevents zombie sessions
- [ ] All scenarios pass manual testing on real Android device or emulator

---

## REQ-03: Authentication & Session Persistence

### Requirement

Implement session persistence that stores the remote endpoint URL, authentication credentials, and active session state using Capacitor's Preferences API. On any disruption (background, network change, app restart), the app SHALL restore its configuration and reconnect automatically without manual reconfiguration. The persistence layer MUST use Capacitor Preferences (not localStorage) because localStorage is not reliably persisted in Android WebView across app restarts.

**Key integration point:** The existing `safeStorage.ts` in `packages/ui/src/stores/utils/` provides a safe Storage wrapper around `localStorage` with in-memory fallback. Session persistence MUST use Capacitor Preferences as the primary store on mobile, with a compatible interface that mirrors the Storage contract where feasible, enabling transparent swap at runtime.

### Scenarios

**SC-03a: First-time configuration persisted**
- GIVEN a user opens the app for the first time
- WHEN they enter a remote server URL (e.g., `http://192.168.1.100:4096`) and authenticate
- THEN the URL, auth credentials, and active session ID are stored via Capacitor Preferences API
- AND the preferences are encrypted at rest by the Android Keystore (Capacitor Preferences uses SharedPreferences which Android encrypts with `EncryptedSharedPreferences` on API 23+; this MUST be verified or explicitly configured)
- AND the app connects to the server and streams data via SSE

**SC-03b: App restart restores configuration**
- GIVEN the app has stored endpoint URL, auth credentials, and session ID in Capacitor Preferences
- WHEN the user closes and reopens the app (cold start)
- THEN the app reads stored credentials from Capacitor Preferences using async APIs
- AND attempts to connect to the stored endpoint automatically
- IF the stored session is still alive (liveness check passes) → reconnect to it
- IF the stored session is stale (liveness check fails) → create a new session with stored credentials
- AND the user does NOT need to re-enter their server URL or credentials

**SC-03c: Background recovery uses stored credentials**
- GIVEN the app goes to background and the SSE connection drops
- WHEN the app returns to foreground
- THEN the connectivity manager (REQ-02) uses stored credentials from Capacitor Preferences to reconnect
- AND the user does NOT need to re-enter their server URL or credentials
- AND session restoration is automatic unless credentials are invalid

**SC-03d: Endpoint is configurable and switchable**
- GIVEN the app is connected to server A
- WHEN the user changes the endpoint URL to server B in settings
- THEN the current SSE connection is terminated cleanly via the connectivity manager
- AND the new endpoint URL and credentials are stored, replacing the old ones in Capacitor Preferences
- AND a new connection is established to server B
- AND the old session state for server A is discarded

**SC-03e: Credentials are never exposed in logs or errors**
- GIVEN any error occurs during connection, authentication, or session restoration
- WHEN the app logs error messages to console or error reporting
- THEN auth tokens, passwords, and credential values SHALL NOT appear in any log output
- AND error messages MUST contain only non-sensitive identifiers (e.g., "authentication failed", "endpoint unreachable")

**SC-03f: Graceful fallback on Capacitor unavailability**
- GIVEN the app runs on web/desktop/VS Code (not in Capacitor)
- WHEN session persistence is initialized
- THEN the module SHALL detect Capacitor unavailability and fall back to the existing `safeStorage.ts` approach (localStorage with in-memory fallback)
- AND no Capacitor-related import errors or runtime crashes occur on non-mobile platforms

### Acceptance Criteria

- [ ] `packages/ui/src/lib/opencode/session-persistence.ts` module exists
- [ ] Uses Capacitor Preferences API as primary persistent store on mobile
- [ ] Falls back to `safeStorage.ts` (localStorage) on non-Capacitor platforms
- [ ] Stores: endpoint URL, auth token, active session ID
- [ ] All storage operations are async (Capacitor Preferences API is async)
- [ ] App restores all configuration on cold start without manual input
- [ ] Endpoint is configurable from settings UI
- [ ] No credentials are logged or exposed in error messages (verified by code review)
- [ ] No Capacitor-related crashes on web/desktop/VS Code runtimes

---

## REQ-04: Connection Status UI Component

### Requirement

Create a shared React component (`ConnectionStatusBar`) that renders the current connection state from the `useConnectionStore` Zustand store. This component MUST be visible but non-intrusive, and MUST NOT cause layout shifts or re-render cascades when connection state changes.

**Performance contract:** Per the project's performance rules (AGENTS.md), the component MUST use leaf selectors from the Zustand store (not subscribe to the entire store), be wrapped in `React.memo` with a custom comparator, and MUST NOT re-render parent components on state changes.

### Scenarios

**SC-04a: Connected state rendering**
- GIVEN the connection state is `connected`
- WHEN the `ConnectionStatusBar` renders
- THEN it shows a small green dot with no text overlay (minimal, unobtrusive)
- AND the component height matches the reserved bar height (no height change)

**SC-04b: Reconnecting state rendering**
- GIVEN the connection state is `reconnecting`
- WHEN the `ConnectionStatusBar` renders
- THEN it shows an amber dot with "Reconnecting..." text
- AND the bar height remains constant (no layout shift)
- AND the text MAY include retry attempt count (e.g., "Reconnecting (attempt 2)...")

**SC-04c: Disconnected state rendering**
- GIVEN the connection state is `disconnected`
- WHEN the `ConnectionStatusBar` renders
- THEN it shows a red dot with "Disconnected" text and a "Retry" action button
- AND tapping "Retry" triggers `useConnectionStore.getState().reconnect()`
- AND the "Retry" button is disabled during `reconnecting` state transitions

**SC-04d: No layout shift between states**
- GIVEN the connection state changes from `connected` → `reconnecting` → `connected`
- WHEN the bar transitions between states
- THEN no layout shift or content jump occurs in the surrounding UI
- AND the bar height remains constant across all states (using reserved space or CSS `min-height`)
- AND transitions between states use CSS transitions (MAY be configurable)

**SC-04e: Component does not cause parent re-renders**
- GIVEN the `ConnectionStatusBar` is mounted inside a parent component
- WHEN the connection state changes frequently (e.g., during `reconnecting` with backoff updates)
- THEN the parent component MUST NOT re-render due to connection state changes
- AND the `ConnectionStatusBar` component uses `React.memo` with a custom comparator comparing only render-relevant fields

**SC-04f: Component is not rendered on desktop/VS Code**
- GIVEN the app runs on web, desktop (Tauri), or VS Code runtime
- WHEN the UI renders
- THEN the `ConnectionStatusBar` component SHALL NOT be rendered (it is mobile-only)
- AND no connection-related subscriptions or Capacitor listeners are active

### Acceptance Criteria

- [ ] `packages/ui/src/components/ConnectionStatusBar.tsx` component exists
- [ ] Subscribes to `useConnectionStore` using leaf selectors (e.g., `useConnectionStore((s) => s.status)`)
- [ ] Three visual states: connected (green), reconnecting (amber), disconnected (red)
- [ ] Disconnected state includes a "Retry" action
- [ ] No layout shift on state transitions (fixed height bar)
- [ ] Component is wrapped in `React.memo` with custom comparator
- [ ] Component is conditionally rendered only when running on a mobile platform (Capacitor detection)
- [ ] Color values use theme tokens from `packages/ui/src/lib/theme/` (no hardcoded colors)

---

## REQ-05: S24 Ultra Layout & Hardware Compatibility

### Requirement

Ensure the OpenChamber UI is comfortable and usable on the Samsung Galaxy S24 Ultra's display (6.8", 3120×1440, 19.5:9 aspect ratio, 120Hz). S-Pen input MUST work through standard web pointer events without custom native plugins. The existing `mobile.css` already handles iOS/mobile-PWA safe areas and layout; this requirement adds Android-specific safe area handling and S24 Ultra viewport adjustments.

### Scenarios

**SC-05a: Layout fills S24 Ultra screen correctly**
- GIVEN the app runs on an S24 Ultra (3120×1440, 19.5:9)
- WHEN the UI renders
- THEN content fills the full 19.5:9 display area (no letterboxing)
- AND safe areas (camera cutout, rounded corners) are respected using `env(safe-area-inset-*)` CSS
- AND touch targets are at least 44×44px per Material Design guidelines
- AND the viewport meta tag is configured with `viewport-fit=cover` for full-screen rendering

**SC-05b: Android safe area insets applied**
- GIVEN the app runs on an Android device with a camera cutout (S24 Ultra)
- WHEN the UI renders in standalone/fullscreen mode
- THEN safe area insets are applied for Android similar to the existing iOS handling in `mobile.css`
- AND `--oc-safe-area-top`, `--oc-safe-area-bottom`, `--oc-safe-area-left`, `--oc-safe-area-right` CSS variables are populated for Android
- AND these variables are consistent with the iOS implementation pattern

**SC-05c: S-Pen interaction works via pointer events**
- GIVEN the app runs on an S24 Ultra with S-Pen
- WHEN the user writes or draws in a text input using the S-Pen
- THEN the browser's pointer events API processes the input correctly (no custom native plugin required)
- AND hover states respond to S-Pen proximity (CSS `:hover` works as expected)
- AND S-Pen eraser button and side button events are handled as standard pointer events

**SC-05d: High refresh rate rendering**
- GIVEN the S24 Ultra's 120Hz display
- WHEN the user scrolls the chat or terminal
- THEN the UI renders at the display's native refresh rate (no 60fps cap from CSS animations or JavaScript)
- AND no jank or dropped frames are visible during SSE streaming content updates
- AND CSS animations use `will-change` and `transform` properties where appropriate for GPU-accelerated rendering

**SC-05e: Landscape orientation support**
- GIVEN the user rotates the S24 Ultra to landscape
- WHEN the orientation changes
- THEN the layout adapts to landscape mode with appropriate column adjustments
- AND the terminal/chat panels reflow correctly
- AND the `ConnectionStatusBar` remains visible and correctly positioned

### Acceptance Criteria

- [ ] Viewport meta tag configured with `viewport-fit=cover` for full-screen rendering
- [ ] Android safe area insets applied via `env(safe-area-inset-*)` (consistent with existing iOS pattern in `mobile.css`)
- [ ] Minimum touch target size of 44×44px for all interactive elements
- [ ] S-Pen works in inputs without custom plugins (pointer events only)
- [ ] No 60fps cap in CSS animations (use GPU-accelerated properties)
- [ ] Landscape layout is functional and readable on 19.5:9 aspect ratio

---

## REQ-06: Connection Store Architecture

### Requirement

The `useConnectionStore` Zustand store MUST follow the project's existing store architecture rules (see `packages/ui/src/stores/DOCUMENTATION.md`). Connection state changes at low frequency compared to SSE events, so it is a narrow, leaf-consumed store — NOT merged into an existing broad store.

### Scenarios

**SC-06a: Store follows Zustand naming and location conventions**
- GIVEN the new connection store is created
- THEN the file is named `useConnectionStore.ts` and placed in `packages/ui/src/stores/`
- AND it follows the `use*Store.ts` naming convention consistent with existing stores

**SC-06b: Store shape is narrow and leaf-consumed**
- GIVEN any component subscribes to connection state
- WHEN the component reads from the store
- THEN it MUST use a leaf selector (e.g., `useConnectionStore((s) => s.status)`) not a broad selector
- AND state updates MUST preserve references for unchanged fields (per AGENTS.md performance rules)

**SC-06c: Store does not trigger re-renders in unrelated components**
- GIVEN the `useConnectionStore` updates (e.g., status changes to `reconnecting`)
- WHEN only the `ConnectionStatusBar` and any direct consumers re-render
- THEN no session sidebar, chat view, or other unrelated components re-render
- AND the store is separate from session stores, sync stores, and UI stores

### Acceptance Criteria

- [ ] `packages/ui/src/stores/useConnectionStore.ts` exists
- [ ] Store shape includes: `status`, `lastConnectedAt`, `retryCount`, `reconnect` action, `disconnect` action
- [ ] Store is separate from existing stores (not merged into `useUIStore` or session stores)
- [ ] Leaf selectors used in all consumer components
- [ ] State updates preserve references for unchanged fields

---

## REQ-07: MVP Integration & Acceptance

### Requirement

The MVP MUST satisfy the four priority criteria in order, and no lower-priority work SHALL block higher-priority deliverables. This is the gating test for Phase 1 completion.

### Priority Order

| Priority | Criteria | Requirements |
|----------|----------|-------------|
| P1 | Connect to remote server | REQ-01 (Capacitor wrapper) + REQ-03 (session persistence) |
| P2 | Usable foreground session | REQ-02 (connectivity baseline) + REQ-05 (layout) |
| P3 | Recover from background/network | REQ-02 (full lifecycle) + REQ-04 (status UI) + REQ-06 (store) |
| P4 | Comfortable on S24 Ultra | REQ-05 (full validation) |

### Scenarios

**SC-07a: MVP smoke test — connect and chat**
- GIVEN the APK is installed on an S24 Ultra
- AND a remote OpenCode server is accessible on the same network
- WHEN the user opens the app
- AND enters the server URL and credentials
- THEN the app connects, streams chat data, and is usable for a coding session
- AND the connection state shows `connected` in the status bar

**SC-07b: MVP smoke test — background recovery**
- GIVEN the user is in an active session
- WHEN they switch to another app for 30+ seconds and return
- THEN the app reconnects within 5 seconds
- AND the session resumes without data loss or manual reconfiguration
- AND the connection state transitions through `paused` → `reconnecting` → `connected`

**SC-07c: MVP smoke test — network change recovery**
- GIVEN the user is on Wi-Fi in an active session
- WHEN they leave Wi-Fi range and the device switches to mobile data
- THEN the app detects the network change, reconnects, and resumes the session
- AND the connection state briefly shows `reconnecting` then `connected`

**SC-07d: MVP smoke test — server restart recovery**
- GIVEN the remote OpenCode server crashes or restarts
- WHEN the server becomes available again
- THEN the mobile app detects the reconnection opportunity via exponential backoff
- AND establishes a new session using stored credentials
- AND the connection state shows `reconnecting` then `connected`

### Acceptance Criteria

- [ ] All P1 criteria pass before P2 work begins
- [ ] All P2 criteria pass before P3 work begins
- [ ] All P3 criteria pass before P4 work begins
- [ ] P1–P3 MUST pass for MVP to ship; P4 MAY have minor issues tracked as follow-up
- [ ] No regression in web, desktop, or VS Code runtimes (existing builds still pass `type-check` and `lint`)

---

## Affected Files Summary

| File | Change |
|------|--------|
| `packages/mobile/` | New — Capacitor project, Android native wrapper, build config |
| `packages/ui/src/lib/opencode/connectivity.ts` | New — Connectivity manager module |
| `packages/ui/src/lib/opencode/session-persistence.ts` | New — Session/auth persistence |
| `packages/ui/src/stores/useConnectionStore.ts` | New — Zustand store for reactive connection state |
| `packages/ui/src/components/ConnectionStatusBar.tsx` | New — Connection status indicator component |
| `packages/ui/src/lib/opencode/client.ts` | Modified — Integrate with connectivity manager for mobile lifecycle |
| `packages/ui/src/sync/event-pipeline.ts` | Modified — Expose hooks for connectivity manager coordination |
| `packages/ui/src/styles/mobile.css` | Modified — Android safe area insets, S24 Ultra viewport adjustments |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE tunnel dies in Android WebView background | High | High | Connectivity manager with lifecycle-aware reconnect + visible UI state (REQ-02) |
| Network transition drops session | Medium | High | Automatic retry with backoff + session restoration from persistent storage (REQ-02, REQ-03) |
| Zombie sessions after reconnect | Medium | High | Liveness validation on resume; discard stale state before reconnecting (REQ-02 SC-02f) |
| Capacitor Preferences not encrypted at rest on older Android | Low | Medium | Verify EncryptedSharedPreferences; document minimum API level requirement (API 23+) |
| DOM performance (terminal/chat) on mobile WebView | Medium | Medium | Profile and optimize hot paths; lazy-load history (REQ-05 SC-05d) |
| Android WebView quirks (safe areas, viewport) | Low | Medium | Test on real S24 Ultra; progressive enhancement (REQ-05) |
| Capacitor plugin unavailability on web/desktop | Low | High | Graceful fallback with platform detection; no-op on non-Capacitor platforms (REQ-02, REQ-03) |

---

## Out of Scope (Deferred)

- Custom native Android plugins for advanced S-Pen features (e.g., hover previews, pressure sensitivity APIs)
- Offline capabilities (the app requires an active connection to a remote OpenCode server)
- iOS application distribution
- Push notifications (future consideration after MVP)
- Android app signing and Play Store distribution (Phase 2)