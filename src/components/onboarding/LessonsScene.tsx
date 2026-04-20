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

const CYCLE = 3600; // ms per full animation cycle

export function LessonsScene({ active }: Props) {
  // Cursor position
  const cursorX = useSharedValue(80);
  const cursorY = useSharedValue(20);
  const cursorScale = useSharedValue(1);

  // Play button
  const playScale = useSharedValue(1);
  const playRing = useSharedValue(0);

  // Waveform
  const bars = [0, 1, 2, 3, 4].map(() => useSharedValue(0.2));

  // Kashmiri text bubble
  const bubbleOpacity = useSharedValue(0);

  // Tick (done)
  const tickOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    const run = () => {
      // Reset
      cursorX.value = 80;
      cursorY.value = 20;
      cursorScale.value = 1;
      playScale.value = 1;
      playRing.value = 0;
      bubbleOpacity.value = 0;
      tickOpacity.value = 0;
      bars.forEach((b) => (b.value = 0.2));

      // Cursor moves toward play button
      cursorX.value = withTiming(-8, { duration: 700, easing: Easing.out(Easing.cubic) });
      cursorY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });

      // Click (scale down then up)
      cursorScale.value = withDelay(
        700,
        withSequence(
          withTiming(0.8, { duration: 120 }),
          withTiming(1, { duration: 120 })
        )
      );
      playScale.value = withDelay(
        780,
        withSequence(
          withTiming(0.9, { duration: 120 }),
          withTiming(1, { duration: 120 })
        )
      );

      // Ring pulse
      playRing.value = withDelay(
        900,
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) })
      );

      // Waveform bars animate
      bars.forEach((b, i) => {
        b.value = withDelay(
          900 + i * 60,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 250 + (i % 3) * 80, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.3, { duration: 250 + (i % 3) * 80, easing: Easing.inOut(Easing.sin) })
            ),
            4,
            false
          )
        );
      });

      // Kashmiri bubble fade in
      bubbleOpacity.value = withDelay(
        1000,
        withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(1400, withTiming(0, { duration: 300 }))
        )
      );

      // Tick appears
      tickOpacity.value = withDelay(
        2800,
        withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(600, withTiming(0, { duration: 300 }))
        )
      );
    };

    run();
    const interval = setInterval(run, CYCLE);
    return () => clearInterval(interval);
  }, [active]);

  const cursorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cursorX.value },
      { translateY: cursorY.value },
      { scale: cursorScale.value },
    ],
  }));

  const playStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - playRing.value,
    transform: [{ scale: 1 + playRing.value * 1.4 }],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [{ translateY: (1 - bubbleOpacity.value) * 12 }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: tickOpacity.value,
    transform: [{ scale: 0.8 + tickOpacity.value * 0.2 }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Lesson card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Lesson 3 · Clip 2 of 10</Text>

        {/* Kashmiri word bubble */}
        <Animated.View style={[styles.bubble, bubbleStyle]}>
          <Text style={styles.bubbleText}>salaam</Text>
        </Animated.View>

        <View style={styles.playRow}>
          {/* Play button with expanding ring */}
          <View style={styles.playWrap}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <Animated.View style={[styles.playBtn, playStyle]}>
              <SymbolView
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' } as any}
                tintColor="#fff"
                size={24}
              />
            </Animated.View>
          </View>

          {/* Waveform */}
          <View style={styles.waveform}>
            {bars.map((b, i) => (
              <AnimatedBar key={i} sv={b} />
            ))}
          </View>

          {/* Tick */}
          <Animated.View style={[styles.tick, tickStyle]}>
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' } as any}
              tintColor="#fff"
              size={14}
            />
          </Animated.View>
        </View>
      </View>

      {/* Cursor */}
      <Animated.View style={[styles.cursor, cursorStyle]}>
        <SymbolView
          name={{ ios: 'hand.point.up.left.fill', android: 'touch_app', web: 'touch_app' } as any}
          tintColor={Colors.text}
          size={36}
        />
      </Animated.View>
    </View>
  );
}

function AnimatedBar({ sv }: { sv: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    height: 8 + sv.value * 32,
  }));
  return <Animated.View style={[styles.bar, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: 300,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 280,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  bubble: {
    position: 'absolute',
    top: -40,
    right: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  bubbleText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  playWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 4,
  },
  bar: {
    width: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 3,
  },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.correct,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursor: {
    position: 'absolute',
    right: 60,
    bottom: 44,
  },
});
