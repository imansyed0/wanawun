import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ComingSoonModal } from '@/src/components/ui/ComingSoonModal';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { logFeatureTap } from '@/src/services/featureInterestService';

export default function HomeScreen() {
  const [isClashModalOpen, setIsClashModalOpen] = useState(false);

  function openClash() {
    logFeatureTap('koshur_clash');
    setIsClashModalOpen(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wanwun</Text>
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
              <Text style={styles.badgeText}>COMING SOON</Text>
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
          {/* Fake door (WAN-48): Koshur Clash isn't ready yet, so instead of
              routing to /game/lobby we log the tap and ask how it should work. */}
          <Button title="Play Now" onPress={openClash} size="lg" />
        </Card>
      </ScrollView>

      <ComingSoonModal
        visible={isClashModalOpen}
        onClose={() => setIsClashModalOpen(false)}
        featureKey="koshur_clash"
        featureName="Koshur Clash"
        description="We're still building head-to-head word battles. Tell us what you'd want from it and we'll use your ideas to shape the game."
      />
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
    backgroundColor: Colors.secondary,
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
