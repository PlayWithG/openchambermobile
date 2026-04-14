/**
 * Session Persistence — Store and restore remote server configuration.
 *
 * Uses Capacitor Preferences API on mobile (SharedPreferences on Android),
 * localStorage fallback on web/desktop/VS Code.
 *
 * Security note: Auth tokens are stored in plaintext for MVP. A future
 * enhancement should migrate to Capacitor SecureStorage or Android Keystore
 * for production distribution.
 */

const PREFIX = 'oc_session_';
const KEYS = {
  endpoint: `${PREFIX}endpoint`,
  authToken: `${PREFIX}auth_token`,
  sessionId: `${PREFIX}session_id`,
  lastConnected: `${PREFIX}last_connected`,
} as const;

export type PersistedSession = {
  endpointUrl: string;
  authToken: string | null;
  sessionId: string | null;
  lastConnectedAt: number | null;
};

/**
 * Get the Capacitor Preferences plugin if available.
 * Uses window.Capacitor.Plugins which is available in Capacitor runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPreferencesPlugin(): any | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const capacitor = win.Capacitor;
  if (!capacitor) return null;
  const plugins = (capacitor as { Plugins?: unknown }).Plugins;
  if (!plugins) return null;
  return (plugins as Record<string, unknown>).Preferences ?? null;
}

/**
 * Session persistence module.
 * 
 * On mobile (Capacitor): uses Preferences API (SharedPreferences on Android).
 * On web/desktop: uses localStorage as fallback.
 */
class SessionPersistence {
  // ---- Storage abstraction ----

  private async capSet(key: string, value: string): Promise<void> {
    const prefs = getPreferencesPlugin();
    if (prefs) {
      await prefs.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  private async capGet(key: string): Promise<string | null> {
    const prefs = getPreferencesPlugin();
    if (prefs) {
      const result = await prefs.get({ key });
      return (result as { value: string | null } | undefined)?.value ?? null;
    }
    return localStorage.getItem(key);
  }

  private async capRemove(key: string): Promise<void> {
    const prefs = getPreferencesPlugin();
    if (prefs) {
      await prefs.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }

  // ---- Public API ----

  async save(session: PersistedSession): Promise<void> {
    try {
      await this.capSet(KEYS.endpoint, session.endpointUrl);
      await this.capSet(KEYS.authToken, session.authToken ?? '');
      await this.capSet(KEYS.sessionId, session.sessionId ?? '');
      await this.capSet(KEYS.lastConnected, String(session.lastConnectedAt ?? ''));
    } catch (error) {
      // Log error type only, never log credential values
      console.error('[SessionPersistence] Failed to save session:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  async load(): Promise<PersistedSession | null> {
    try {
      const endpoint = await this.capGet(KEYS.endpoint);
      if (!endpoint) return null;

      const authToken = await this.capGet(KEYS.authToken);
      const sessionId = await this.capGet(KEYS.sessionId);
      const rawLastConnected = await this.capGet(KEYS.lastConnected);

      return {
        endpointUrl: endpoint,
        authToken: authToken || null,
        sessionId: sessionId || null,
        lastConnectedAt: rawLastConnected ? Number(rawLastConnected) : null,
      };
    } catch (error) {
      console.error('[SessionPersistence] Failed to load session:', error instanceof Error ? error.message : 'unknown error');
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.capRemove(KEYS.endpoint);
      await this.capRemove(KEYS.authToken);
      await this.capRemove(KEYS.sessionId);
      await this.capRemove(KEYS.lastConnected);
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear session:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  /** Update a single field without replacing the entire session */
  async updateField<K extends keyof PersistedSession>(field: K, value: PersistedSession[K]): Promise<void> {
    const keyMap: Record<keyof PersistedSession, string> = {
      endpointUrl: KEYS.endpoint,
      authToken: KEYS.authToken,
      sessionId: KEYS.sessionId,
      lastConnectedAt: KEYS.lastConnected,
    };

    const key = keyMap[field];
    if (!key) return;

    try {
      await this.capSet(key, String(value ?? ''));
    } catch (error) {
      console.error(`[SessionPersistence] Failed to update field ${field}:`, error instanceof Error ? error.message : 'unknown error');
    }
  }
}

export const sessionPersistence = new SessionPersistence();