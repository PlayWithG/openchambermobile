/**
 * Connection State Store — narrow Zustand store for SSE connection lifecycle.
 *
 * Separated from useUIStore for performance:
 * - Leaf selectors for minimal re-renders
 * - Reference preservation for unchanged fields
 * - Focused domain (connection state only)
 */

import { create } from 'zustand';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStore {
  /** Current connection state */
  state: ConnectionState;
  /** Timestamp of last successful connection */
  lastConnectedAt: number | null;
  /** Timestamp of last disconnection */
  lastDisconnectedAt: number | null;
  /** Current reconnect attempt counter */
  reconnectAttempt: number;
  /** Current endpoint URL */
  endpointUrl: string | null;

  /** Update state with timestamps and reset reconnect on success */
  setState: (newState: ConnectionState) => void;
  /** Update endpoint URL */
  setEndpoint: (url: string | null) => void;
  /** Increment reconnect attempt counter */
  incrementReconnectAttempt: () => void;
  /** Reset reconnect attempt counter to 0 */
  resetReconnectAttempt: () => void;
}

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  state: 'disconnected',
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnectAttempt: 0,
  endpointUrl: null,

  setState: (newState: ConnectionState) => {
    set((prev) => {
      // On transition to connected: update state, timestamp, reset reconnect counter
      if (newState === 'connected') {
        return {
          state: newState,
          lastConnectedAt: Date.now(),
          reconnectAttempt: 0,
        };
      }

      // On transition to disconnected: update state, timestamp
      if (newState === 'disconnected') {
        return {
          state: newState,
          lastDisconnectedAt: Date.now(),
        };
      }

      // On transition to reconnecting: update state, increment attempt
      if (newState === 'reconnecting') {
        return {
          state: newState,
          reconnectAttempt: prev.reconnectAttempt + 1,
        };
      }

      return { state: newState };
    });
  },

  setEndpoint: (url: string | null) => {
    set({ endpointUrl: url });
  },

  incrementReconnectAttempt: () => {
    set((prev) => ({ reconnectAttempt: prev.reconnectAttempt + 1 }));
  },

  resetReconnectAttempt: () => {
    set({ reconnectAttempt: 0 });
  },
}));

/** Leaf selector for connection state — subscribes only to state changes */
export const useConnectionState = () => useConnectionStore((s) => s.state);

/** Leaf selector for endpoint URL — subscribes only to endpoint changes */
export const useConnectionEndpoint = () => useConnectionStore((s) => s.endpointUrl);

/** Leaf selector for reconnect attempt counter — subscribes only to attempt changes */
export const useReconnectAttempt = () => useConnectionStore((s) => s.reconnectAttempt);