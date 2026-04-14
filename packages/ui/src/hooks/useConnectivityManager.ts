/**
 * useConnectivityManager — initialization hook for mobile connectivity lifecycle.
 *
 * This hook initializes the ConnectivityManager singleton when running
 * on a Capacitor platform, and wires its reconnect events to the event pipeline.
 *
 * On non-mobile runtimes, this is a no-op.
 */

import { useEffect } from 'react';
import { connectivityManager } from '@/lib/opencode/connectivity';
import { isCapacitorPlatform } from '@/lib/opencode/platform';
import { triggerPipelineReconnect } from '@/sync/sync-refs';

/**
 * React hook to initialize connectivity manager on mount.
 * Wires mobile lifecycle events (App background/foreground, Network change)
 * to the SSE event pipeline for proper reconnection coordination.
 */
export function useConnectivityManager(): void {
  useEffect(() => {
    // Only run on Capacitor platforms
    if (!isCapacitorPlatform()) {
      return;
    }

    // Start the connectivity manager (registers App/Network listeners)
    connectivityManager.start();

    // Wire connectivity manager's reconnect callback to abort and restart the SSE stream.
    // This ensures that when mobile lifecycle events occur (network restored, app
    // foreground), the event pipeline is also restarted to fetch fresh data.
    const unsubscribe = connectivityManager.onReconnect(() => {
      // Trigger the pipeline to abort its current SSE stream and reconnect
      triggerPipelineReconnect();
    });

    return () => {
      unsubscribe();
      connectivityManager.stop();
    };
  }, []);
}