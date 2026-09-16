import { useRef, useState } from 'react';
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
import { useRouter, type Href } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { authCallbackUrl } from '@/src/lib/authRedirect';

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleResetPassword() {
    setError('');
    setResetMessage('');
    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }
    setResetting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authCallbackUrl(),
      });
      if (resetError) throw resetError;
      setResetMessage('Check your email for a reset link');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  async function handleLogin() {
    setError('');
    setResetMessage('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      // Sign-in is the app's front door now, so there's nothing to go back to:
      // hand over to the index route, which starts the tour or opens the Glossary.
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setResetMessage('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    // iOS: let the ScrollView inset itself natively, which is more reliable than
    // KeyboardAvoidingView's offset maths. Android is edge-to-edge, where
    // behavior="height" doesn't resize, so pad instead.
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior="padding"
      enabled={Platform.OS === 'android'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue learning Koshur</Text>

          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {resetMessage ? <Text style={styles.success}>{resetMessage}</Text> : null}

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
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              ref={passwordRef}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
            <Button
              title={resetting ? 'Sending...' : 'Forgot Password?'}
              onPress={handleResetPassword}
              variant="ghost"
              disabled={resetting}
            />
            <Button
              title={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
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
                {googleLoading ? 'Connecting...' : 'Sign in with Google'}
              </Text>
            </Pressable>
          </View>

          <Button
            title="Don't have an account? Sign Up"
            onPress={() => {
              // New learners answer Naani's level question before making an account.
              router.push('/welcome/level' as Href);
            }}
            variant="ghost"
          />
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
    color: Colors.primary,
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
