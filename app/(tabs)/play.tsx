import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wanawun</Text>
          <Text style={styles.subtitle}>Learn Koshur Together</Text>
          <Text style={styles.tagline}>
            Kashmiri language games for two
          </Text>
        </View>

        <ScreenHeaderDecoration variant="saffron" />

        {/* Koshur Clash card */}
        <Card style={styles.gameCard}>
          <View style={styles.gameCardHeader}>
            <View>
              <Text style={styles.gameTitle}>Koshur Clash</Text>
              <Text style={styles.gameSubtitle}>Real-time word battle</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.gameDescription}>
            Race head-to-head! Translate Kashmiri words faster than your
            opponent to win.
          </Text>
          <View style={styles.gameStats}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>10 rounds</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>~3 min</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>2 players</Text>
            </View>
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
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    position: 'relative',
  },
  title: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: FontFamily.bodySemi,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  gameCard: {
    gap: Spacing.md,
  },
  gameCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gameTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  gameSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.correct,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: '#fff',
    letterSpacing: 1,
  },
  gameDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  gameStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statPill: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statPillText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bodySemi,
  },
});
