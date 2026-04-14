/**
 * OpenChamber Mobile — Capacitor entry point.
 *
 * This module exports the mobile bridge that initializes
 * Capacitor plugins and provides the mobile runtime adapter.
 *
 * NOTE: Capacitor plugins should be initialized at runtime by the native shell.
 * When running in a web/desktop context, these imports are no-ops.
 * 
 * The plugins are available via window.Capacitor.Plugins when running
 * in the Capacitor native environment.
 */

// Mobile runtime detection
export function isMobilePlatform(): boolean {
  return typeof window !== 'undefined' &&
    // Capacitor sets window.Capacitor when running in native shell
    'Capacitor' in (window as unknown as Record<string, unknown>);
}

// Re-export platform detection for use in shared UI
export { isMobilePlatform as isCapacitor };