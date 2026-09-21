import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { disconnectStrava, getStravaStatus, startStravaAuthorize, type StravaStatus } from './client';

export type ConnectResult = 'connected' | 'denied' | 'cancelled' | 'failed';

interface UseStravaConnectionResult extends StravaStatus {
  isLoading: boolean;
  connect: () => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const EMPTY_STATUS: StravaStatus = { connected: false, stravaAthleteId: null, connectedAt: null };

/** Extracts `?key=value` query params from a redirect URL without relying on the URL class, which handles custom schemes inconsistently across RN's polyfills -- mirrors auth-provider.tsx's own manual parsing of its OAuth redirect. */
function parseQueryParams(url: string): URLSearchParams {
  const queryString = url.split('?')[1] ?? '';
  return new URLSearchParams(queryString);
}

/**
 * Strava connection state, kept out of StoreProvider since it isn't part of
 * the core fitness dataset -- it's account-level integration state, not
 * something GitFit itself is the system of record for.
 */
export function useStravaConnection(): UseStravaConnectionResult {
  const [status, setStatus] = useState<StravaStatus>(EMPTY_STATUS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getStravaStatus());
    } catch (error) {
      console.warn('Failed to fetch Strava connection status', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // A direct `refreshStatus()` call here (rather than this inline async IIFE)
  // is calling a state-setting function synchronously in an effect body,
  // which the lint rule flags -- mirrors the same cancelled-flag shape
  // store-provider.tsx uses for its own hydration effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextStatus = await getStravaStatus();
        if (!cancelled) setStatus(nextStatus);
      } catch (error) {
        console.warn('Failed to fetch Strava connection status', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (): Promise<ConnectResult> => {
    // The final app-side redirect target varies by environment (a fixed
    // mygymapp:// scheme in a standalone build, an exp://.../--/ proxy URL
    // under Expo Go) -- computed here and echoed back by
    // strava-oauth-callback, since Strava's registered redirect_uri must be
    // one fixed HTTPS URL and can't vary the way Supabase's own OAuth proxy
    // does for the Google sign-in flow.
    const redirectTo = Linking.createURL('strava-callback');
    try {
      const authorizeUrl = await startStravaAuthorize(redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectTo);
      if (result.type !== 'success') return 'cancelled';

      const params = parseQueryParams(result.url);
      if (params.get('success') !== 'true') {
        return params.get('reason') === 'denied' ? 'denied' : 'failed';
      }
      await refreshStatus();
      return 'connected';
    } catch (error) {
      console.warn('Strava connect failed', error);
      return 'failed';
    }
  }, [refreshStatus]);

  const disconnect = useCallback(async () => {
    await disconnectStrava();
    await refreshStatus();
  }, [refreshStatus]);

  return { ...status, isLoading, connect, disconnect, refreshStatus };
}
