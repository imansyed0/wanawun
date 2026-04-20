import { GoogleSignin } from '@react-native-google-signin/google-signin';

const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '634866738820-9o9o2cod17nkvld9n6lep7gio788b241.apps.googleusercontent.com';
const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '634866738820-hg22gagq4ab6aigtb7fte977rt0jih0r.apps.googleusercontent.com';

GoogleSignin.configure({ iosClientId, webClientId });

export async function nativeGoogleSignIn(): Promise<string> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!response.data?.idToken) {
    throw new Error('No ID token returned from Google');
  }
  return response.data.idToken;
}
