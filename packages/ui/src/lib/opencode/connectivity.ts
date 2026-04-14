/**
 * ConnectivityManager — manages SSE connection lifecycle on mobile.
 *
 * Runtime-agnostic: on web/desktop, all methods are no-ops.
 * Uses window.Capacitor.Plugins to access Capacitor plugins at runtime.
 */

import { useConnectionStore, type ConnectionState } from '@/stores/useConnectionStore';
import { isCapacitorPlatform } from './platform';

export type ConnectivityManagerConfig = {
  baseUrl: string;
  backoff: {
    initialMs: number;
    maxMs: number;
    multiplier: number;
  };
  heartbeatTimeoutMs: number;
  healthPath: string;
};

const DEFAULT_CONFIG: ConnectivityManagerConfig = {
  baseUrl: '/api',
  backoff: {
    initialMs: 1000,
    maxMs: 30000,
    multiplier: 2,
  },
  heartbeatTimeoutMs: 15000,
  healthPath: '/health',
};

/** Get Capacitor App plugin from window.Capacitor.Plugins — returns null on non-mobile */
function getCapacitorAppPlugin(): { addListener: (event: string, callback: (state: { state: string }) => void) => Promise<{ remove: () => void }> } | null {
  if (!isCapacitorPlatform()) return null;
  const win = window as unknown as Record<string, unknown>;
  const capacitor = win.Capacitor as { Plugins?: Record<string, unknown> } | undefined;
  const plugins = capacitor?.Plugins;
  if (!plugins) return null;
  return plugins.App as { addListener: (event: string, callback: (state: { state: string }) => void) => Promise<{ remove: () => void }> } | null;
}

/** Get Capacitor Network plugin from window.Capacitor.Plugins — returns null on non-mobile */
function getCapacitorNetworkPlugin(): { addListener: (event: string, callback: (status: { connected: boolean; connectionType: string }) => void) => Promise<{ remove: () => void }>; getStatus: () => Promise<{ connected: boolean; connectionType: string }> } | null {
  if (!isCapacitorPlatform()) return null;
  const win = window as unknown as Record<string, unknown>;
  const capacitor = win.Capacitor as { Plugins?: Record<string, unknown> } | undefined;
  const plugins = capacitor?.Plugins;
  if (!plugins) return null;
  return plugins.Network as { addListener: (event: string, callback: (status: { connected: boolean; connectionType: string }) => void) => Promise<{ remove: () => void }>; getStatus: () => Promise<{ connected: boolean; connectionType: string }> } | null;
}

export class ConnectivityManager {
  private config: ConnectivityManagerConfig;
  private isMobile: boolean;
  private isForeground: boolean = true;
  private isOnline: boolean = true;
  private backoffMs: number;
  private backoffAttempt: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private livenessCheckInProgress: boolean = false;
  private appStateListener: (() => void) | null = null;
  private networkStateListener: (() => void) | null = null;
  private started: boolean = false;

  constructor(config?: Partial<ConnectivityManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isMobile = isCapacitorPlatform();
    this.backoffMs = this.config.backoff.initialMs;
  }

  /**
   * Start listening to Capacitor plugins.
   * No-op on non-mobile runtimes.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // Initialize with disconnected state
    this.setState('disconnected');

    if (!this.isMobile) {
      // On non-mobile, default to connected (SSE handles itself)
      this.setState('connected');
      return;
    }

    this.registerAppListener();
    this.registerNetworkListener();
  }

  /**
   * Stop and cleanup all listeners and timers.
   */
  stop(): void {
    this.started = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.appStateListener) {
      this.appStateListener = null;
    }

    if (this.networkStateListener) {
      this.networkStateListener = null;
    }

    // Reset to disconnected on stop
    this.setState('disconnected');
  }

  /**
   * Force a reconnect attempt.
   */
  reconnect(): void {
    if (!this.isMobile) return;

    const currentState = useConnectionStore.getState().state;
    if (currentState === 'connected') {
      // Already connected, no need to reconnect
      return;
    }

    this.attemptReconnect();
  }

  /**
   * Get current connection state from store.
   */
  getState(): ConnectionState {
    return useConnectionStore.getState().state;
  }

  private async registerAppListener(): Promise<void> {
    const App = getCapacitorAppPlugin();
    if (!App) {
      console.warn('[connectivity] Capacitor App plugin not available');
      return;
    }

    try {
      const listener = await App.addListener('appStateChange', (state) => {
        this.onAppStateChanged(state.state as 'foreground' | 'background');
      });
      this.appStateListener = () => {
        listener.remove();
      };
    } catch (error) {
      console.warn('[connectivity] Failed to register app state listener:', error);
    }
  }

  private async registerNetworkListener(): Promise<void> {
    const Network = getCapacitorNetworkPlugin();
    if (!Network) {
      console.warn('[connectivity] Capacitor Network plugin not available');
      return;
    }

    try {
      // Get initial status
      const status = await Network.getStatus();
      this.isOnline = status.connected;

      const listener = await Network.addListener('networkStatusChange', (status) => {
        this.onNetworkStateChanged(status);
      });
      this.networkStateListener = () => {
        listener.remove();
      };
    } catch (error) {
      console.warn('[connectivity] Failed to register network listener:', error);
    }
  }

  private onAppStateChanged(state: 'foreground' | 'background'): void {
    const wasForeground = this.isForeground;
    this.isForeground = state === 'foreground';

    if (!wasForeground && this.isForeground) {
      // App moved to foreground — validate liveness before reconnecting
      // Transition through reconnecting state
      this.setState('reconnecting');
      this.handleForegroundResume();
    } else if (wasForeground && !this.isForeground) {
      // App moved to background — mark as paused (app is hidden, not necessarily disconnected)
      this.setState('paused');
    }
  }

  private onNetworkStateChanged(status: { connected: boolean; connectionType: string }): void {
    const wasOnline = this.isOnline;
    this.isOnline = status.connected;

    if (!wasOnline && this.isOnline) {
      // Network restored — attempt reconnect
      this.attemptReconnect();
    } else if (wasOnline && !this.isOnline) {
      // Network lost — mark as disconnected
      this.setState('disconnected');
    }
  }

  private async handleForegroundResume(): Promise<void> {
    if (this.livenessCheckInProgress) return;

    this.livenessCheckInProgress = true;

    try {
      const isAlive = await this.validateLiveness();
      if (isAlive) {
        this.attemptReconnect();
      } else {
        // Server not responding, schedule retry with backoff
        this.scheduleReconnect();
      }
    } finally {
      this.livenessCheckInProgress = false;
    }
  }

  private async validateLiveness(): Promise<boolean> {
    const healthUrl = `${this.config.baseUrl}${this.config.healthPath}`;

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.heartbeatTimeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private attemptReconnect(): void {
    // Cancel any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    const state = useConnectionStore.getState().state;

    if (state === 'connected') {
      // Already connected
      this.resetBackoff();
      return;
    }

    this.setState('reconnecting');
    useConnectionStore.getState().incrementReconnectAttempt();

    // Signal external reconnect listeners (e.g., event-pipeline)
    this.notifyReconnectListeners();
  }

  // ---- Reconnect listener management ----

  private reconnectListeners: Set<() => void> = new Set();

  /**
   * Register a callback to be invoked when a reconnect is triggered.
   * The event-pipeline uses this to abort the current SSE stream and start a new one.
   */
  onReconnect(callback: () => void): () => void {
    this.reconnectListeners.add(callback);
    return () => {
      this.reconnectListeners.delete(callback);
    };
  }

  private notifyReconnectListeners(): void {
    for (const listener of this.reconnectListeners) {
      try {
        listener();
      } catch (error) {
        console.error('[connectivity] Reconnect listener error:', error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = this.nextBackoffDelay();
    this.backoffAttempt++;

    this.setState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.handleForegroundResume();
    }, delay);
  }

  private nextBackoffDelay(): number {
    const baseDelay = this.backoffMs * Math.pow(this.config.backoff.multiplier, this.backoffAttempt);
    const capped = Math.min(baseDelay, this.config.backoff.maxMs);
    // Add ±25% jitter to prevent thundering herd
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.max(this.config.backoff.initialMs, capped + jitter);
  }

  private resetBackoff(): void {
    this.backoffMs = this.config.backoff.initialMs;
    this.backoffAttempt = 0;
  }

  private setState(newState: ConnectionState): void {
    useConnectionStore.getState().setState(newState);
  }
}

// Singleton instance — consumers import this
export const connectivityManager = new ConnectivityManager();