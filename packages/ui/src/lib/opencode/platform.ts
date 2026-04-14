/**
 * Platform detection for the OpenChamber UI.
 *
 * Provides runtime-agnostic platform checks that work across
 * web, desktop (Tauri), VS Code, and mobile (Capacitor) runtimes.
 */

/** Check if running inside a Capacitor native shell */
export function isCapacitorPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Capacitor' in (window as unknown as Record<string, unknown>);
}

/** Check if running on a mobile device (Capacitor or PWA) */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Capacitor native shell
  if (isCapacitorPlatform()) return true;
  
  // PWA or mobile browser detection
  const isMobilePointer = document.documentElement.classList.contains('mobile-pointer');
  const isDeviceMobile = document.documentElement.classList.contains('device-mobile');
  
  return isMobilePointer || isDeviceMobile;
}

/** Check if running in desktop (Tauri) runtime */
export function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  const apis = win.__OPENCHAMBER_RUNTIME_APIS__ as Record<string, unknown> | undefined;
  return Boolean(apis?.runtime && (apis.runtime as Record<string, unknown>)?.isDesktop);
}