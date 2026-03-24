import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChinarLeaf } from '@/src/components/ui/ChinarLeaf';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { getGlossaryWords } from '@/src/services/wordService';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [wordCount, setWordCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadWordCount() {
        if (!user?.id) {
          if (active) setWordCount(0);
          return;
        }

        try {
          const words = await getGlossaryWords(user.id);
          if (active) setWordCount(words.length);
        } catch {
          if (active) setWordCount(0);
        }
      }

      loadWordCount();

      return () => {
        active = false;
      };
    }, [user?.id])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authPrompt}>
          <ChinarLeaf size={64} color={Colors.primary} opacity={0.1} style={{ alignSelf: 'center' }} />
          <Text style={styles.title}>Join Wanawun</Text>
          <Text style={styles.subtitle}>
            Sign in to track your progress and play with friends
          </Text>
          <View style={styles.authButtons}>
            <Button
              title="Sign In"
              onPress={() => router.push('/auth/login')}
              size="lg"
            />
            <Button
              title="Create Account"
              onPress={() => router.push('/auth/register')}
              variant="outline"
              size="lg"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.display_name ?? 'P')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'Player'}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <ScreenHeaderDecoration variant="saffron" />

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.elo_rating ?? 1000}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.games_played ?? 0}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{wordCount}</Text>
            <Text style={styles.statLabel}>Words</Text>
          </Card>
        </View>

        <Button
          title="Sign Out"
          onPress={signOut}
          variant="ghost"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: Spacing.xxl,
    color: Colors.textSecondary,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
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
    lineHeight: 22,
  },
  authButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.secondaryLight,
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: '#fff',
  },
  displayName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
