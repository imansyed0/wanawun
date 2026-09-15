import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turn raw Supabase auth errors into something a learner can act on. */
function friendlySignUpError(err: any): string {
  const message: string = err?.message ?? '';
  const code: string = err?.code ?? '';
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return "We've sent too many emails just now. Please wait a little while and try again.";
  }
  if (/only request this after/i.test(message)) {
    return 'Please wait a minute before requesting another email.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (code === 'weak_password' || /password should/i.test(message)) {
    return message || 'Please choose a stronger password.';
  }
  if (code === 'email_address_invalid' || (/invalid/i.test(message) && /email/i.test(message))) {
    return 'That email address looks invalid. Please check it and try again.';
  }
  if (/sending confirmation email|not authorized/i.test(message)) {
    return "We couldn't send your confirmation email. Please try again later or sign up with Google.";
  }
  return message || 'Something went wrong creating your account.';
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, resendSignUpEmail, signInWithGoogle } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleRegister() {
    setError('');
    setSuccess('');
    const trimmedEmail = email.trim();
    if (!displayName.trim() || !trimmedEmail || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(trimmedEmail, password, displayName);
      if (result.session) {
        // Signed in straight away (email confirmation off): leave the modal,
        // same as login does.
        router.back();
        return;
      }
      if (result.alreadyRegistered) {
        setError('An account with this email already exists. Sign in instead, or use "Forgot Password?" on the sign-in screen.');
        return;
      }
      setAwaitingConfirmation(true);
      setSuccess(`Account created! We sent a confirmation link to ${trimmedEmail}. Open it on this phone to finish signing up.`);
    } catch (err: any) {
      setError(friendlySignUpError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      await resendSignUpEmail(email);
      setSuccess(`We sent another confirmation link to ${email.trim()}. Check your spam folder if it doesn't arrive.`);
    } catch (err: any) {
      setError(friendlySignUpError(err));
    } finally {
      setResending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.back();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  function goToSignIn() {
    router.back();
    router.push('/auth/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.lg : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Join Wanwun</Text>
          <Text style={styles.subtitle}>Create an account to start learning Koshur</Text>

          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            {awaitingConfirmation ? (
              <>
                <Button
                  title={resending ? 'Sending...' : 'Resend confirmation email'}
                  onPress={handleResend}
                  disabled={resending}
                  variant="ghost"
                />
                <Button title="I've confirmed - Sign In" onPress={goToSignIn} size="lg" />
                <Button
                  title="Use a different email"
                  onPress={() => {
                    setAwaitingConfirmation(false);
                    setSuccess('');
                    setError('');
                  }}
                  variant="ghost"
                />
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Display Name"
                  placeholderTextColor={Colors.textLight}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  textContentType="nickname"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={handleRegister}
                />
                <Button
                  title={loading ? 'Creating account...' : 'Create Account'}
                  onPress={handleRegister}
                  disabled={loading}
                  size="lg"
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading}
                  style={({ pressed }) => [
                    styles.googleButton,
                    pressed && styles.googleButtonPressed,
                    googleLoading && styles.googleButtonDisabled,
                  ]}
                >
                  <Text style={styles.googleButtonText}>
                    {googleLoading ? 'Connecting...' : 'Sign up with Google'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {!awaitingConfirmation && (
            <Button
              title="Already have an account? Sign In"
              onPress={goToSignIn}
              variant="ghost"
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    justifyContent: 'flex-start',
    paddingTop: Spacing.xxl * 1.5,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  error: {
    color: Colors.wrong,
    fontSize: FontSize.sm,
    textAlign: 'center',
    padding: Spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  success: {
    color: Colors.correct,
    fontSize: FontSize.sm,
    textAlign: 'center',
    padding: Spacing.sm,
    backgroundColor: '#EDF4F0',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontFamily: FontFamily.bodySemi,
  },
  googleButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyBold,
    color: Colors.text,
    letterSpacing: 0.3,
  },
});
