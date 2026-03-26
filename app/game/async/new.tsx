import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { createAsyncGame } from '@/src/services/gameService';
import { supabase } from '@/src/lib/supabase';

export default function NewAsyncGameScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [opponentEmail, setOpponentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!user) return;
    setError('');
    if (!opponentEmail.trim()) {
      setError('Enter your opponent\'s email');
      return;
    }

    setLoading(true);
    try {
      // Find opponent by email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .ilike('email', opponentEmail.trim())
        .limit(1);

      if (!profiles || profiles.length === 0) {
        setError('No player found with that email');
        setLoading(false);
        return;
      }

      const opponent = profiles[0];
      if (opponent.id === user.id) {
        setError('You can\'t play against yourself!');
        setLoading(false);
        return;
      }

      const game = await createAsyncGame(user.id, opponent.id);
      router.replace(`/game/async/${game.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Messenger Game</Text>
      <Text style={styles.subtitle}>
        Challenge a friend to a game of Koshur Messenger!
        Build sentences with hidden trap words for each other.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Opponent's Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter their email..."
          placeholderTextColor={Colors.textLight}
          value={opponentEmail}
          onChangeText={(t) => { setOpponentEmail(t); setError(''); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          secureTextEntry
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          title={loading ? 'Creating...' : 'Start Game'}
          onPress={handleCreate}
          disabled={loading}
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
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
  errorText: {
    color: Colors.wrong,
    fontSize: FontSize.sm,
    backgroundColor: '#fef2f2',
    padding: Spacing.sm,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
