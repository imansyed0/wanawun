import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { useTutorialStore } from '@/src/stores/tutorialStore';
import { supabase } from '@/src/lib/supabase';
import { getGlossaryWords } from '@/src/services/wordService';
import { deleteAccount } from '@/src/services/accountService';

export default function ProfileScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, profile, loading, signOut } = useAuth();
  const [wordCount, setWordCount] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Something went wrong.');
      setDeleting(false);
      return;
    }

    // The account is gone, so the access token is dead and signOut may well
    // fail server-side. Clearing local state is what matters here.
    try {
      await signOut();
    } catch {
      // Ignored — the session is unusable either way.
    }

    setDeleting(false);
    setConfirmingDelete(false);
    router.replace('/');
  }

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
          <Text style={styles.title}>Join Wanwun</Text>
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
      {/* Scrolls: on a short screen Sign Out was sliced by the tab bar and
          Delete Account was off the bottom entirely, with no way to reach
          either. Account deletion has to stay reachable on every phone. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
            <Text style={styles.statLabel}>Games Played</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{wordCount}</Text>
            <Text style={styles.statLabel}>Words Learned</Text>
          </Card>
        </View>

        <Button
          title="Replay Naani's tour"
          onPress={() => {
            useTutorialStore.getState().start();
            router.push('/learn');
          }}
          variant="outline"
        />
        <Button
          title="Sign Out"
          onPress={signOut}
          variant="ghost"
        />
        <Button
          title="Delete Account"
          onPress={() => {
            setDeleteError(null);
            setConfirmingDelete(true);
          }}
          variant="dangerGhost"
          size="sm"
        />
      </ScrollView>

      <Modal
        visible={confirmingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setConfirmingDelete(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalBody}>
              This permanently removes your profile, saved words/phrases, lesson progress and
              game history. It cannot be undone, and you will need to create a new
              account to use Wanwun again.
            </Text>

            {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}

            {deleting ? (
              <ActivityIndicator color={Colors.wrong} style={styles.modalSpinner} />
            ) : (
              <View style={styles.modalActions}>
                <Button
                  title="Delete Forever"
                  onPress={handleDeleteAccount}
                  variant="danger"
                />
                <Button
                  title="Cancel"
                  onPress={() => setConfirmingDelete(false)}
                  variant="ghost"
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(47, 58, 53, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  modalBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  modalError: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
    fontFamily: FontFamily.bodyBold,
  },
  modalSpinner: {
    paddingVertical: Spacing.md,
  },
  modalActions: {
    gap: Spacing.xs,
  },
});
