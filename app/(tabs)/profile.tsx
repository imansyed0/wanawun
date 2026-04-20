import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { getGlossaryWords } from '@/src/services/wordService';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [wordCount, setWordCount] = useState(0);
  const [gameCount, setGameCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadProgressCounts() {
        if (!user?.id) {
          if (active) {
            setWordCount(0);
            setGameCount(0);
          }
          return;
        }

        try {
          const [
            words,
            syncGamesResult,
            asyncGamesResult,
          ] = await Promise.all([
            getGlossaryWords(user.id),
            supabase
              .from('sync_games')
              .select('*', { count: 'exact', head: true })
              .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
              .not('player_b', 'is', null)
              .neq('status', 'waiting'),
            supabase
              .from('async_games')
              .select('*', { count: 'exact', head: true })
              .or(`player_a.eq.${user.id},player_b.eq.${user.id}`),
          ]);

          if (!active) return;

          setWordCount(words.length);
          setGameCount((syncGamesResult.count ?? 0) + (asyncGamesResult.count ?? 0));
        } catch {
          if (active) {
            setWordCount(0);
            setGameCount(0);
          }
        }
      }

      loadProgressCounts();

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
            <Text style={styles.statValue}>{gameCount}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{wordCount}</Text>
            <Text style={styles.statLabel}>Words</Text>
          </Card>
        </View>

        <Button
          title="How to use the app"
          onPress={() => router.push('/onboarding?replay=1')}
          variant="outline"
        />
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
    fontFamily: FontFamily.headingBold,
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
    fontFamily: FontFamily.bodyHeavy,
    color: '#fff',
  },
  displayName: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
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
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
