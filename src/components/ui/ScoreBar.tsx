import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

interface ScoreBarProps {
  playerAName: string;
  playerBName: string;
  playerAScore: number;
  playerBScore: number;
  currentRound?: number;
  totalRounds?: number;
}

export function ScoreBar({
  playerAName,
  playerBName,
  playerAScore,
  playerBScore,
  currentRound,
  totalRounds,
}: ScoreBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.playerSection}>
        <Text style={styles.playerName} numberOfLines={1}>
          {playerAName}
        </Text>
        <Text style={styles.score}>{playerAScore}</Text>
      </View>

      {currentRound !== undefined && totalRounds !== undefined && (
        <View style={styles.roundBadge}>
          <Text style={styles.roundText}>
            {currentRound}/{totalRounds}
          </Text>
        </View>
      )}

      <View style={[styles.playerSection, styles.playerRight]}>
        <Text style={styles.playerName} numberOfLines={1}>
          {playerBName}
        </Text>
        <Text style={styles.score}>{playerBScore}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  playerSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  score: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  roundBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roundText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#fff',
  },
});
