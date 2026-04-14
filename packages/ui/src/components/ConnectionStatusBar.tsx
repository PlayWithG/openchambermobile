/**
 * ConnectionStatusBar — mobile-only status indicator for SSE connection state.
 *
 * Displays connection status at the top of the UI on Capacitor platforms.
 * Uses leaf selectors to avoid re-renders from unrelated store changes.
 */

import React from 'react';
import { useConnectionState } from '@/stores/useConnectionStore';
import { useReconnectAttempt } from '@/stores/useConnectionStore';
import { isCapacitorPlatform } from '@/lib/opencode/platform';
import { connectivityManager } from '@/lib/opencode/connectivity';

/** State colors using theme tokens */
const STATE_COLORS = {
  connected: 'var(--color-status-success)',
  reconnecting: 'var(--color-status-warning)',
  disconnected: 'var(--color-status-error)',
} as const;

/** Fixed height to prevent layout shift */
const BAR_HEIGHT = '2rem'; // h-8

interface ConnectionStatusBarInnerProps {
  state: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempt: number;
}

/**
 * Inner component — receives props via leaf selectors to minimize re-renders.
 * Wrapped in React.memo to skip renders when props are unchanged.
 */
const ConnectionStatusBarInner = React.memo<ConnectionStatusBarInnerProps>(
  ({ state, reconnectAttempt }) => {
    const handleRetry = React.useCallback(() => {
      connectivityManager.reconnect();
    }, []);

    const renderContent = () => {
      switch (state) {
        case 'connected':
          // Minimal: green dot only, no text
          return (
            <div
              className="flex items-center justify-center"
              style={{ height: BAR_HEIGHT }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATE_COLORS.connected }}
              />
            </div>
          );

        case 'reconnecting':
          return (
            <div
              className="flex items-center px-3 gap-2"
              style={{ height: BAR_HEIGHT }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: STATE_COLORS.reconnecting }}
              />
              <span
                className="text-xs text-foreground/80"
                style={{ fontSize: '0.75rem' }}
              >
                Reconnecting… (attempt {reconnectAttempt})
              </span>
            </div>
          );

        case 'disconnected':
          return (
            <div
              className="flex items-center px-3 gap-2"
              style={{ height: BAR_HEIGHT }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATE_COLORS.disconnected }}
              />
              <span
                className="text-xs text-foreground/80"
                style={{ fontSize: '0.75rem' }}
              >
                Disconnected
              </span>
              <button
                type="button"
                onClick={handleRetry}
                className="ml-auto px-2 py-0.5 text-xs rounded border transition-colors"
                style={{
                  borderColor: STATE_COLORS.disconnected,
                  color: STATE_COLORS.disconnected,
                  fontSize: '0.75rem',
                }}
              >
                Retry
              </button>
            </div>
          );
      }
    };

    return (
      <div
        className="w-full border-b"
        style={{
          height: BAR_HEIGHT,
          borderColor: 'var(--border)',
          backgroundColor: 'var(--background)',
        }}
      >
        {renderContent()}
      </div>
    );
  }
);

ConnectionStatusBarInner.displayName = 'ConnectionStatusBarInner';

/**
 * ConnectionStatusBar — entry point.
 * Only renders on Capacitor platforms.
 * Uses leaf selectors to subscribe only to connection state changes.
 */
export const ConnectionStatusBar: React.FC = () => {
  // Early return for non-mobile platforms
  if (!isCapacitorPlatform()) {
    return null;
  }

  // Leaf selectors — subscribe only to state changes, not entire store
  const state = useConnectionState();
  const reconnectAttempt = useReconnectAttempt();

  return <ConnectionStatusBarInner state={state} reconnectAttempt={reconnectAttempt} />;
};