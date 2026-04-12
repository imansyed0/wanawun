import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  iosClientId: '634866738820-9o9o2cod17nkvld9n6lep7gio788b241.apps.googleusercontent.com',
  webClientId: '634866738820-9o9o2cod17nkvld9n6lep7gio788b241.apps.googleusercontent.com',
});

export async function nativeGoogleSignIn(): Promise<string> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!response.data?.idToken) {
    throw new Error('No ID token returned from Google');
  }
  return response.data.idToken;
}
