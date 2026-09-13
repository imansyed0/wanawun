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

const EMAIL_CONFIRMED_PAGE = 'https://wanwun.org/auth/confirmed';

/**
 * Where Supabase should send a new user after they tap the sign-up
 * confirmation email.
 *
 * Native goes via a real web page rather than straight to `wanawun://`: mail
 * apps' in-app browsers (and Android Chrome) silently refuse a redirect to a
 * custom scheme, which left users staring at a blank page. site/auth/confirmed.html
 * tells them they're confirmed and forwards the code into the app. Must be in
 * the Supabase Redirect URLs allow-list, like authCallbackUrl.
 */
export function emailConfirmationUrl(): string {
  if (Platform.OS === 'web') return authCallbackUrl();
  return EMAIL_CONFIRMED_PAGE;
}
