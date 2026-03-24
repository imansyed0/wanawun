import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleRegister() {
    setError('');
    setSuccess('');
    if (!displayName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      setSuccess('Account created! Check your email to confirm.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Wanawun</Text>
      <Text style={styles.subtitle}>Create an account to start learning Koshur</Text>

      <View style={styles.form}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor={Colors.textLight}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
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
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={Colors.textLight}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button
          title={loading ? 'Creating account...' : 'Create Account'}
          onPress={handleRegister}
          disabled={loading}
          size="lg"
        />
      </View>

      <Button
        title="Already have an account? Sign In"
        onPress={() => {
          router.back();
          router.push('/auth/login');
        }}
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
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
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});
