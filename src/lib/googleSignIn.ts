import { Platform } from 'react-native';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '634866738820-9o9o2cod17nkvld9n6lep7gio788b241.apps.googleusercontent.com';
// Must be the *Web application* OAuth client (not the Android one). On Android
// the ID token's `aud` is this client, so it must also be listed in Supabase ->
// Auth -> Providers -> Google (Client ID / Authorized Client IDs).
const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '634866738820-hg22gagq4ab6aigtb7fte977rt0jih0r.apps.googleusercontent.com';

GoogleSignin.configure({ iosClientId, webClientId });

/** Thrown when the user dismisses the Google account picker. */
export class GoogleSignInCancelledError extends Error {
  readonly cancelled = true;
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

// Android GoogleSignInStatusCodes / CommonStatusCodes that come back as strings.
const ANDROID_DEVELOPER_ERROR = '10';
const ANDROID_NETWORK_ERROR = '7';
const ANDROID_SIGN_IN_FAILED = '12500';

function describeGoogleError(error: unknown): Error {
  if (!isErrorWithCode(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const { code } = error;
  let message: string;
  switch (code) {
    case ANDROID_DEVELOPER_ERROR:
      message =
        'Google Sign-In is misconfigured for this build (DEVELOPER_ERROR). ' +
        "The app's signing certificate SHA-1 is not registered on an Android OAuth client " +
        'in the same Google Cloud project as the web client ID.';
      break;
    case ANDROID_SIGN_IN_FAILED:
      message =
        'Google Sign-In failed (SIGN_IN_FAILED). Check the OAuth consent screen is configured ' +
        '(published, or your account is a test user).';
      break;
    case ANDROID_NETWORK_ERROR:
      message = 'Google Sign-In failed: network error. Check your connection and try again.';
      break;
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      message = 'Google Play Services is missing or out of date on this device.';
      break;
    case statusCodes.IN_PROGRESS:
      message = 'Google Sign-In is already in progress.';
      break;
    default:
      message = `Google Sign-In failed: ${error.message}`;
  }

  const wrapped = new Error(`${message} [code ${code}]`);
  (wrapped as Error & { code?: string }).code = code;
  return wrapped;
}

/** Decodes the (unverified) JWT payload for diagnostics only. */
function tokenClaimsForLog(idToken: string) {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    return { aud: claims.aud, azp: claims.azp, iss: claims.iss, hasNonce: 'nonce' in claims };
  } catch {
    return null;
  }
}

export async function nativeGoogleSignIn(): Promise<string> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Clear any stale cached Google account so the picker always shows and a
    // previously failed/revoked session can't short-circuit the flow.
    try {
      await GoogleSignin.signOut();
    } catch {
      // not signed in; ignore
    }

    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      throw new GoogleSignInCancelledError();
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error(
        'Google returned no ID token. Check that webClientId is the Web application OAuth client.',
      );
    }

    if (__DEV__) {
      console.log('[GoogleSignIn] token claims', Platform.OS, tokenClaimsForLog(idToken));
    }
    return idToken;
  } catch (error) {
    if (error instanceof GoogleSignInCancelledError) throw error;
    const described = describeGoogleError(error);
    console.error('[GoogleSignIn] native sign-in failed', Platform.OS, {
      code: isErrorWithCode(error) ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    throw described;
  }
}

export async function nativeGoogleSignOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google; ignore
  }
}
