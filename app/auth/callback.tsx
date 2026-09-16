import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

type Status = 'pending' | 'success' | 'error' | 'reset-password';

const LINK_FAILED_MESSAGE =
  "We couldn't sign you in from this link. If you were confirming your email, you're all set - just sign in with your email and password.";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Confirming your account...');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const confirmPasswordRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const initialUrl = await Linking.getInitialURL();
      const code =
        (typeof params.code === 'string' && params.code) ||
        extractCodeFromUrl(initialUrl);
      const linkError =
        (typeof params.error_description === 'string' && params.error_description) ||
        (typeof params.error === 'string' && params.error) ||
        null;

      if (linkError) {
        if (!cancelled) {
          setStatus('error');
          setMessage(linkError);
        }
        return;
      }

      if (!code) {
        if (!cancelled) {
          setStatus('error');
          setMessage(LINK_FAILED_MESSAGE);
        }
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        // Usually the link was opened on a different device or after a
        // reinstall, so this device has no code verifier. Supabase already
        // confirmed the email before redirecting, so signing in still works.
        console.warn('Auth code exchange failed', error);
        setStatus('error');
        setMessage(LINK_FAILED_MESSAGE);
        return;
      }

      // PKCE never fires a PASSWORD_RECOVERY auth event - exchangeCodeForSession
      // always notifies SIGNED_IN. resetPasswordForEmail tags the stored code
      // verifier instead, and the exchange hands that tag back as redirectType
      // (present at runtime, absent from the public AuthTokenResponse type).
      const isRecovery =
        (data as { redirectType?: string | null } | null)?.redirectType === 'PASSWORD_RECOVERY';

      if (isRecovery) {
        setStatus('reset-password');
        setMessage('Choose a new password');
        return;
      }

      setStatus('success');
      setMessage("Email confirmed! You're signed in.");
      // Go through the index route so a new user who hasn't seen the welcome
      // tour gets it, instead of being dropped straight onto Lessons.
      setTimeout(() => {
        if (!cancelled) router.replace('/');
      }, 600);
    }

    run().catch((err) => {
      if (cancelled) return;
      setStatus('error');
      setMessage(err?.message ?? 'Something went wrong confirming your account.');
    });

    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, params.error_description, router]);

  async function handleSetPassword() {
    if (!newPassword.trim()) {
      setMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setStatus('reset-password');
        setMessage(error.message);
        return;
      }
      setStatus('success');
      setMessage('Password updated! Taking you to your glossary...');
      setTimeout(() => router.replace('/learn'), 600);
    } catch (err: any) {
      setMessage(err?.message ?? 'Something went wrong updating your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Same keyboard handling as the sign-in/sign-up screens: native insets on iOS,
    // padding on edge-to-edge Android.
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior="padding"
      enabled={Platform.OS === 'android'}
    >
    <ScrollView
      contentContainerStyle={styles.container}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {status === 'pending' && <ActivityIndicator color={Colors.primary} size="large" />}
      <Text style={[styles.message, status === 'error' && styles.messageError]}>{message}</Text>

      {status === 'reset-password' && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={Colors.textLight}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoFocus
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={Colors.textLight}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSetPassword}
          />
          <Button
            title={saving ? 'Saving...' : 'Set New Password'}
            onPress={handleSetPassword}
            disabled={saving}
            size="lg"
          />
        </View>
      )}

      {status === 'error' && (
        <Button
          title="Sign in"
          onPress={() => router.replace('/auth/login')}
          size="lg"
        />
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function extractCodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    if (typeof code === 'string' && code) return code;
  } catch {
    // fall through
  }
  return null;
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  message: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemi,
    color: Colors.text,
    textAlign: 'center',
  },
  messageError: {
    color: Colors.wrong,
  },
  form: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.md,
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
});
