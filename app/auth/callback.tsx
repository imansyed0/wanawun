import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

type Status = 'pending' | 'success' | 'error' | 'reset-password';

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

  useEffect(() => {
    let cancelled = false;

    let isRecovery = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') isRecovery = true;
    });

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
          setMessage('Confirmation link is missing a code. Try opening the link again from your email.');
        }
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      listener.subscription.unsubscribe();

      if (isRecovery) {
        setStatus('reset-password');
        setMessage('Choose a new password');
        return;
      }

      setStatus('success');
      setMessage("You're signed in. Taking you to your lessons...");
      setTimeout(() => {
        if (!cancelled) router.replace('/lessons');
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
      setMessage('Password updated! Taking you to your lessons...');
      setTimeout(() => router.replace('/lessons'), 600);
    } catch (err: any) {
      setMessage(err?.message ?? 'Something went wrong updating your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
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
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={Colors.textLight}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
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
          title="Back to sign in"
          onPress={() => router.replace('/auth/login')}
          size="lg"
        />
      )}
    </View>
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
  container: {
    flex: 1,
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
