import { Platform } from 'react-native';

const APP_SCHEME_CALLBACK = 'wanawun://auth/callback';

/**
 * Where Supabase should send the user after they open an emailed auth link.
 *
 * Native gets the app's custom scheme. Web gets the page's own origin, because
 * a browser cannot follow `wanawun://`. Every URL this can return has to be in
 * the Supabase project's Redirect URLs allow-list or the link comes back with
 * `error=redirect_to_not_allowed`.
 */
export function authCallbackUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return APP_SCHEME_CALLBACK;
}
