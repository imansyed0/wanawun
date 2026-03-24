import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Wanawun</Text>
          <Text style={styles.subtitle}>Learn Koshur Together</Text>
        </View>

        <Card style={styles.gameCard}>
          <View style={styles.gameCardHeader}>
            <Text style={styles.gameTitle}>Koshur Duel</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.gameDescription}>
            Race head-to-head in real-time! Translate Kashmiri words faster than
            your opponent to win.
          </Text>
          <View style={styles.gameStats}>
            <Text style={styles.gameStat}>10 rounds</Text>
            <Text style={styles.gameStat}>~3 min</Text>
            <Text style={styles.gameStat}>2 players</Text>
          </View>
          <Button
            title="Play Now"
            onPress={() => router.push('/game/lobby')}
            size="lg"
          />
        </Card>
      </ScrollView>
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
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  gameCard: {
    gap: Spacing.md,
  },
  gameCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    backgroundColor: Colors.correct,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  gameDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  gameStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  gameStat: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
