export class GoogleSignInCancelledError extends Error {
  readonly cancelled = true;
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

export async function nativeGoogleSignIn(): Promise<string> {
  throw new Error('Google Sign-In is not supported on web. Please use the mobile app.');
}

export async function nativeGoogleSignOut(): Promise<void> {}
