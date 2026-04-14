/**
 * Mobile Bridge — Provides Capacitor plugin access to the shared UI layer.
 *
 * This module abstracts Capacitor plugin APIs so that the shared UI
 * code in packages/ui can use mobile features without direct
 * Capacitor dependencies.
 */

export type AppState = 'foreground' | 'background';
export type NetworkType = 'wifi' | 'cellular' | 'unknown' | 'none' | 'ethernet' | 'cell' | '2g' | '3g' | '4g';

interface ConnectionStatus {
  connected: boolean;
  connectionType: NetworkType;
}

interface AppStateEvent {
  isActive: boolean;
}

export interface MobileBridge {
  onAppStateChanged(callback: (state: AppState) => void): () => void;
  onNetworkStateChanged(callback: (status: { connected: boolean; connectionType: string }) => void): () => void;
  getCurrentNetworkStatus(): Promise<{ connected: boolean; connectionType: string }>;
}

/**
 * Create a mobile bridge using Capacitor plugins.
 * Returns a no-op bridge if not running on a Capacitor platform.
 */
export function createMobileBridge(): MobileBridge {
  const isCapacitor = typeof window !== 'undefined' &&
    'Capacitor' in (window as unknown as Record<string, unknown>);

  if (!isCapacitor) {
    // No-op bridge for web/desktop/VS Code
    return {
      onAppStateChanged: () => () => {},
      onNetworkStateChanged: () => () => {},
      getCurrentNetworkStatus: async () => ({ connected: navigator.onLine, connectionType: 'unknown' }),
    };
  }

  // Dynamically import Capacitor plugins to avoid build failures when not installed
  const App = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener: (event: string, handler: (state: AppStateEvent) => void) => Promise<{ remove: () => void }> } } } }).Capacitor?.Plugins?.App;
  const Network = (window as unknown as { Capacitor?: { Plugins?: { Network?: { addListener: (event: string, handler: (status: ConnectionStatus) => void) => Promise<{ remove: () => void }>; getStatus: () => Promise<ConnectionStatus> } } } }).Capacitor?.Plugins?.Network;

  if (!App || !Network) {
    return {
      onAppStateChanged: () => () => {},
      onNetworkStateChanged: () => () => {},
      getCurrentNetworkStatus: async () => ({ connected: navigator.onLine, connectionType: 'unknown' }),
    };
  }

  return {
    onAppStateChanged(callback: (state: AppState) => void): () => void {
      const handler = App.addListener('appStateChange', (state: AppStateEvent) => {
        callback(state.isActive ? 'foreground' : 'background');
      });

      return () => {
        handler.then((h: { remove: () => void }) => h.remove()).catch(() => {});
      };
    },

    onNetworkStateChanged(callback: (status: { connected: boolean; connectionType: string }) => void): () => void {
      const handler = Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        callback({
          connected: status.connected,
          connectionType: status.connectionType,
        });
      });

      return () => {
        handler.then((h: { remove: () => void }) => h.remove()).catch(() => {});
      };
    },

    async getCurrentNetworkStatus(): Promise<{ connected: boolean; connectionType: string }> {
      try {
        const status = await Network.getStatus();
        return {
          connected: status.connected,
          connectionType: status.connectionType,
        };
      } catch {
        return { connected: navigator.onLine, connectionType: 'unknown' };
      }
    },
  };
}