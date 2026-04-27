import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

type Status = 'pending' | 'success' | 'error';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Confirming your account...');

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

  return (
    <View style={styles.container}>
      {status === 'pending' && <ActivityIndicator color={Colors.primary} size="large" />}
      <Text style={[styles.message, status === 'error' && styles.messageError]}>{message}</Text>
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
});
