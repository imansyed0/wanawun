export async function nativeGoogleSignIn(): Promise<string> {
  throw new Error('Google Sign-In is not supported on web. Please use the mobile app.');
}
