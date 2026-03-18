import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JMAPClient } from '@/lib/jmap/client';
import { useEmailStore } from './email-store';
import { useIdentityStore } from './identity-store';
import { useContactStore } from './contact-store';
import { useVacationStore } from './vacation-store';
import { useCalendarStore } from './calendar-store';
import { useFilterStore } from './filter-store';
import { useSettingsStore } from './settings-store';
import { fetchConfig } from '@/hooks/use-config';
import { debug } from '@/lib/debug';
import type { Identity } from '@/lib/jmap/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  serverUrl: string | null;
  username: string | null;
  client: JMAPClient | null;
  identities: Identity[];
  primaryIdentity: Identity | null;
  authMode: 'basic' | 'oauth';
  rememberMe: boolean;
  accessToken: string | null;
  tokenExpiresAt: number | null;
  connectionLost: boolean;

  login: (serverUrl: string, username: string, password: string, totp?: string, rememberMe?: boolean) => Promise<boolean>;
  loginWithOAuth: (serverUrl: string, code: string, codeVerifier: string, redirectUri: string) => Promise<boolean>;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  syncIdentities: () => void;
}

const ERROR_PATTERNS: Array<{ key: string; matches: string[] }> = [
  { key: 'cors_blocked', matches: ['CORS_ERROR'] },
  { key: 'invalid_credentials', matches: ['Invalid username or password', '401', 'Unauthorized'] },
  { key: 'connection_failed', matches: ['network', 'Failed to fetch', 'NetworkError', 'ECONNREFUSED'] },
  { key: 'server_error', matches: ['500', '502', '503', '504', 'Internal Server Error', 'Service Unavailable'] },
];

function classifyLoginError(error: unknown): string {
  if (!(error instanceof Error)) return 'generic';
  const msg = error.message;
  for (const { key, matches } of ERROR_PATTERNS) {
    if (matches.some((pattern) => msg.includes(pattern))) return key;
  }
  return 'generic';
}

function emailMatchesUsername(email: string, username: string): boolean {
  if (email === username) return true;
  // Handle local-part login: username "user" should match "user@domain.tld"
  if (!username.includes('@') && email.split('@')[0] === username) return true;
  return false;
}

function sortIdentities(rawIdentities: Identity[], username: string): Identity[] {
  return [...rawIdentities].sort((a, b) => {
    const aMatch = emailMatchesUsername(a.email, username);
    const bMatch = emailMatchesUsername(b.email, username);
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    // Among matching identities, prefer canonical (non-deletable) over aliases
    if (aMatch && bMatch) {
      if (!a.mayDelete && b.mayDelete) return -1;
      if (a.mayDelete && !b.mayDelete) return 1;
    }
    return 0;
  });
}

function loadIdentities(rawIdentities: Identity[], username: string): { identities: Identity[]; primaryIdentity: Identity | null } {
  const preferredPrimaryId = useIdentityStore.getState().preferredPrimaryId;
  const identities = sortIdentities(rawIdentities, username);

  // If user has a preferred primary, move it to front
  if (preferredPrimaryId) {
    const idx = identities.findIndex((id) => id.id === preferredPrimaryId);
    if (idx > 0) {
      const [preferred] = identities.splice(idx, 1);
      identities.unshift(preferred);
    }
  }

  const primaryIdentity = identities[0] ?? null;
  useIdentityStore.getState().setIdentities(identities);
  return { identities, primaryIdentity };
}

function markSessionExpired(): void {
  try { sessionStorage.setItem('session_expired', 'true'); } catch { /* noop */ }
}

function initializeFeatureStores(client: JMAPClient): void {
  if (client.supportsContacts()) {
    const contactStore = useContactStore.getState();
    contactStore.setSupportsSync(true);
    contactStore.fetchAddressBooks(client).catch((err) => debug.error('Failed to fetch address books:', err));
    contactStore.fetchContacts(client).catch((err) => debug.error('Failed to fetch contacts:', err));
  } else {
    useContactStore.getState().setSupportsSync(false);
  }

  const vacationStore = useVacationStore.getState();
  if (client.supportsVacationResponse()) {
    vacationStore.setSupported(true);
    vacationStore.fetchVacationResponse(client).catch((err) => debug.error('Failed to fetch vacation response:', err));
  } else {
    vacationStore.setSupported(false);
  }

  if (client.supportsCalendars()) {
    const calendarStore = useCalendarStore.getState();
    calendarStore.setSupported(true);
    calendarStore.fetchCalendars(client).catch((err) => debug.error('Failed to fetch calendars:', err));
  }

  if (client.supportsSieve()) {
    const filterStore = useFilterStore.getState();
    filterStore.setSupported(true);
    filterStore.fetchFilters(client).catch((err) => debug.error('Failed to fetch filters:', err));
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<string | null> | null = null;

function scheduleRefresh(expiresIn: number, refreshFn: () => Promise<string | null>): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const refreshAt = Math.max((expiresIn - 60) * 1000, 10_000);
  refreshTimer = setTimeout(() => {
    refreshFn().catch((err) => {
      debug.error('Scheduled token refresh failed:', err);
    });
  }, refreshAt);
}

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  refreshPromise = null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      serverUrl: null,
      username: null,
      client: null,
      identities: [],
      primaryIdentity: null,
      authMode: 'basic',
      rememberMe: false,
      accessToken: null,
      tokenExpiresAt: null,
      connectionLost: false,

      login: async (serverUrl, username, password, totp, rememberMe) => {
        const effectivePassword = totp ? `${password}$${totp}` : password;
        set({ isLoading: true, error: null });

        try {
          const client = new JMAPClient(serverUrl, username, effectivePassword);
          client.onConnectionChange((connected) => {
            set({ connectionLost: !connected });
          });
          await client.connect();

          const { identities, primaryIdentity } = loadIdentities(await client.getIdentities(), username);
          initializeFeatureStores(client);

          set({
            isAuthenticated: true,
            isLoading: false,
            serverUrl,
            username,
            client,
            identities,
            primaryIdentity,
            authMode: 'basic',
            accessToken: null,
            tokenExpiresAt: null,
            connectionLost: false,
            error: null,
          });

          // Sync settings from server (only if enabled)
          fetchConfig().then(config => {
            if (!config.settingsSyncEnabled) return;
            useSettingsStore.getState().loadFromServer(username, serverUrl).finally(() => {
              useSettingsStore.getState().enableSync(username, serverUrl);
            });
          }).catch(() => {});

          if (rememberMe) {
            try {
              const res = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverUrl, username, password: effectivePassword }),
              });
              if (res.ok) {
                set({ rememberMe: true });
              } else {
                debug.error('Failed to store session: server returned', res.status);
              }
            } catch (err) {
              debug.error('Failed to store session:', err);
            }
          }

          return true;
        } catch (error) {
          debug.error('Login error:', error);
          set({
            isLoading: false,
            error: classifyLoginError(error),
            isAuthenticated: false,
            client: null,
          });
          return false;
        }
      },

      loginWithOAuth: async (serverUrl, code, codeVerifier, redirectUri) => {
        set({ isLoading: true, error: null });

        try {
          const tokenRes = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
          });

          if (!tokenRes.ok) {
            throw new Error('token_exchange_failed');
          }

          const { access_token, expires_in } = await tokenRes.json();

          const refreshFn = get().refreshAccessToken;
          const client = JMAPClient.withBearer(serverUrl, access_token, '', () => refreshFn());
          client.onConnectionChange((connected) => {
            set({ connectionLost: !connected });
          });
          await client.connect();

          const username = client.getUsername();
          const { identities, primaryIdentity } = loadIdentities(await client.getIdentities(), username);
          initializeFeatureStores(client);

          set({
            isAuthenticated: true,
            isLoading: false,
            serverUrl,
            username,
            client,
            identities,
            primaryIdentity,
            authMode: 'oauth',
            accessToken: access_token,
            tokenExpiresAt: Date.now() + expires_in * 1000,
            connectionLost: false,
            error: null,
          });

          scheduleRefresh(expires_in, get().refreshAccessToken);

          // Sync settings from server (only if enabled)
          fetchConfig().then(config => {
            if (!config.settingsSyncEnabled) return;
            useSettingsStore.getState().loadFromServer(username, serverUrl).finally(() => {
              useSettingsStore.getState().enableSync(username, serverUrl);
            });
          }).catch(() => {});

          return true;
        } catch (error) {
          debug.error('OAuth login error:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'generic',
            isAuthenticated: false,
            client: null,
          });
          return false;
        }
      },

      refreshAccessToken: async () => {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
          try {
            const res = await fetch('/api/auth/token', { method: 'PUT' });

            if (!res.ok) {
              markSessionExpired();
              get().logout();
              return null;
            }

            const { access_token, expires_in } = await res.json();

            get().client?.updateAccessToken(access_token);

            set({
              accessToken: access_token,
              tokenExpiresAt: Date.now() + expires_in * 1000,
            });

            scheduleRefresh(expires_in, get().refreshAccessToken);
            return access_token;
          } catch (error) {
            debug.error('Token refresh failed:', error);
            markSessionExpired();
            get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      logout: () => {
        const state = get();
        const wasOAuth = state.authMode === 'oauth';

        clearRefreshTimer();
        state.client?.disconnect();

        useSettingsStore.getState().disableSync();

        set({
          isAuthenticated: false,
          serverUrl: null,
          username: null,
          client: null,
          identities: [],
          primaryIdentity: null,
          authMode: 'basic',
          rememberMe: false,
          accessToken: null,
          tokenExpiresAt: null,
          connectionLost: false,
          error: null,
        });

        localStorage.removeItem('auth-storage');

        useEmailStore.setState({
          emails: [],
          mailboxes: [],
          selectedEmail: null,
          selectedMailbox: "",
          isLoading: false,
          error: null,
          searchQuery: "",
          quota: null,
        });

        useIdentityStore.getState().clearIdentities();
        useContactStore.getState().clearContacts();
        useVacationStore.getState().clearState();
        useCalendarStore.getState().clearState();
        useFilterStore.getState().clearState();

        fetch('/api/auth/session', { method: 'DELETE' }).catch((err) => {
          debug.error('Failed to clear session cookie:', err);
        });

        if (wasOAuth) {
          fetch('/api/auth/token', { method: 'DELETE' })
            .then((res) => {
              if (!res.ok) throw new Error(`Revocation failed: ${res.status}`);
              return res.json();
            })
            .then((data) => {
              if (data.end_session_url) {
                const locale = window.location.pathname.split('/')[1] || 'en';
                const redirectUri = `${window.location.origin}/${locale}/login`;
                const url = new URL(data.end_session_url);
                url.searchParams.set('post_logout_redirect_uri', redirectUri);
                window.location.href = url.toString();
              }
            })
            .catch((err) => {
              debug.error('OAuth logout cleanup failed:', err);
            });
        }
      },

      checkAuth: async () => {
        const state = get();

        if (state.isAuthenticated && !state.client) {
          if (state.authMode === 'oauth' && state.serverUrl) {
            set({ isLoading: true });
            try {
              const token = await get().refreshAccessToken();
              if (token && state.serverUrl) {
                const refreshFn = get().refreshAccessToken;
                const client = JMAPClient.withBearer(state.serverUrl, token, state.username || '', () => refreshFn());
                client.onConnectionChange((connected) => {
                  set({ connectionLost: !connected });
                });
                await client.connect();

                const { identities, primaryIdentity } = loadIdentities(await client.getIdentities(), state.username || '');
                initializeFeatureStores(client);

                set({
                  isAuthenticated: true,
                  isLoading: false,
                  client,
                  identities,
                  primaryIdentity,
                  accessToken: token,
                });

                // Sync settings from server (only if enabled)
                fetchConfig().then(config => {
                  if (!config.settingsSyncEnabled) return;
                  useSettingsStore.getState().loadFromServer(state.username || '', state.serverUrl!).finally(() => {
                    useSettingsStore.getState().enableSync(state.username || '', state.serverUrl!);
                  });
                }).catch(() => {});
                return;
              }
            } catch (error) {
              debug.error('OAuth session restore failed:', error);
              clearRefreshTimer();
            }
          }

          if (state.authMode === 'basic') {
            set({ isLoading: true });
            try {
              const res = await fetch('/api/auth/session');
              if (res.ok) {
                const data = await res.json();
                if (!data.serverUrl || !data.username || !data.password) {
                  debug.error('Session restore returned incomplete data');
                  throw new Error('Incomplete session data');
                }
                const { serverUrl, username, password } = data;
                const client = new JMAPClient(serverUrl, username, password);
                client.onConnectionChange((connected) => {
                  set({ connectionLost: !connected });
                });
                await client.connect();

                const { identities, primaryIdentity } = loadIdentities(await client.getIdentities(), username);
                initializeFeatureStores(client);

                set({
                  isAuthenticated: true,
                  isLoading: false,
                  serverUrl,
                  username,
                  client,
                  identities,
                  primaryIdentity,
                  authMode: 'basic',
                });

                // Sync settings from server (only if enabled)
                fetchConfig().then(config => {
                  if (!config.settingsSyncEnabled) return;
                  useSettingsStore.getState().loadFromServer(username, serverUrl).finally(() => {
                    useSettingsStore.getState().enableSync(username, serverUrl);
                  });
                }).catch(() => {});
                return;
              }
            } catch (error) {
              debug.error('Basic session restore failed:', error);
            }
          }

          markSessionExpired();

          set({
            isAuthenticated: false,
            isLoading: false,
            client: null,
            serverUrl: null,
            username: null,
            authMode: 'basic',
            rememberMe: false,
            accessToken: null,
            tokenExpiresAt: null,
          });
        }

        set({ isLoading: false });
      },

      clearError: () => set({ error: null }),

      syncIdentities: () => {
        const identityState = useIdentityStore.getState();
        const identities = identityState.identities;
        const primaryIdentity = identities[0] ?? null;
        set({ identities, primaryIdentity });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        serverUrl: state.serverUrl,
        username: state.username,
        authMode: state.authMode,
        isAuthenticated: (state.authMode === 'oauth' || state.rememberMe)
          ? state.isAuthenticated
          : undefined,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
