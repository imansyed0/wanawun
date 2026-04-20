import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

type Props = { active: boolean };

const CYCLE = 4400;

export function ClashScene({ active }: Props) {
  // Options
  const opt1Highlight = useSharedValue(0);
  const opt2Highlight = useSharedValue(0);
  const opt3Highlight = useSharedValue(0);

  // Player states
  const p1Scale = useSharedValue(1);
  const p1Glow = useSharedValue(0);
  const p2Shake = useSharedValue(0);

  // ELO pop
  const eloY = useSharedValue(0);
  const eloOpacity = useSharedValue(0);

  // VS pulse
  const vsPulse = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    vsPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    const run = () => {
      // Reset
      opt1Highlight.value = 0;
      opt2Highlight.value = 0;
      opt3Highlight.value = 0;
      p1Scale.value = 1;
      p1Glow.value = 0;
      p2Shake.value = 0;
      eloY.value = 0;
      eloOpacity.value = 0;

      // Player 1 picks correct option (middle)
      opt2Highlight.value = withDelay(
        1000,
        withTiming(1, { duration: 250 })
      );

      // Winner reaction
      p1Scale.value = withDelay(
        1400,
        withSequence(
          withTiming(1.1, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 200 })
        )
      );
      p1Glow.value = withDelay(
        1400,
        withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(800, withTiming(0, { duration: 400 }))
        )
      );

      // Player 2 shakes
      p2Shake.value = withDelay(
        1400,
        withSequence(
          withTiming(-4, { duration: 80 }),
          withTiming(4, { duration: 80 }),
          withTiming(-3, { duration: 80 }),
          withTiming(0, { duration: 80 })
        )
      );

      // ELO floats up
      eloY.value = withDelay(
        1600,
        withTiming(-24, { duration: 900, easing: Easing.out(Easing.cubic) })
      );
      eloOpacity.value = withDelay(
        1600,
        withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(500, withTiming(0, { duration: 400 }))
        )
      );
    };

    run();
    const interval = setInterval(run, CYCLE);
    return () => clearInterval(interval);
  }, [active]);

  const opt1Style = useAnimatedStyle(() => ({
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.border,
  }));
  const opt2Style = useAnimatedStyle(() => ({
    backgroundColor: `rgba(45, 106, 79, ${opt2Highlight.value * 0.9 + 0.08})`,
    borderColor: opt2Highlight.value > 0.5 ? Colors.correct : Colors.border,
  }));
  const opt3Style = useAnimatedStyle(() => ({
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.border,
  }));

  const p1Style = useAnimatedStyle(() => ({
    transform: [{ scale: p1Scale.value }],
  }));

  const p1GlowStyle = useAnimatedStyle(() => ({
    opacity: p1Glow.value,
    transform: [{ scale: 1 + p1Glow.value * 0.4 }],
  }));

  const p2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p2Shake.value }],
  }));

  const eloStyle = useAnimatedStyle(() => ({
    opacity: eloOpacity.value,
    transform: [{ translateY: eloY.value }],
  }));

  const vsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + vsPulse.value * 0.1 }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Players */}
      <View style={styles.playersRow}>
        <Animated.View style={p1Style}>
          <View style={styles.playerCol}>
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarGlow, p1GlowStyle]} />
              <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
                <Text style={styles.avatarText}>A</Text>
              </View>
              <Animated.View style={[styles.eloPop, eloStyle]}>
                <Text style={styles.eloText}>+24</Text>
              </Animated.View>
            </View>
            <Text style={styles.playerName}>You</Text>
            <Text style={styles.playerElo}>1024</Text>
          </View>
        </Animated.View>

        <Animated.View style={vsStyle}>
          <Text style={styles.vs}>VS</Text>
        </Animated.View>

        <Animated.View style={p2Style}>
          <View style={styles.playerCol}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: Colors.secondary }]}>
                <Text style={styles.avatarText}>R</Text>
              </View>
            </View>
            <Text style={styles.playerName}>Rizwan</Text>
            <Text style={styles.playerElo}>1050</Text>
          </View>
        </Animated.View>
      </View>

      {/* Question */}
      <View style={styles.question}>
        <Text style={styles.qLabel}>Translate:</Text>
        <Text style={styles.qWord}>salaam</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsRow}>
        <Animated.View style={[styles.option, opt1Style]}>
          <Text style={styles.optText}>water</Text>
        </Animated.View>
        <Animated.View style={[styles.option, opt2Style]}>
          <Text style={styles.optText}>hello</Text>
        </Animated.View>
        <Animated.View style={[styles.option, opt3Style]}>
          <Text style={styles.optText}>book</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 300,
    height: 270,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 280,
    gap: Spacing.sm,
  },
  playerCol: {
    alignItems: 'center',
    gap: 2,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.streak,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  eloPop: {
    position: 'absolute',
    top: -4,
    backgroundColor: Colors.correct,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  eloText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  playerName: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  playerElo: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  vs: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.secondaryLight,
  },
  question: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  qLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  qWord: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    width: 280,
  },
  option: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  optText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
});
