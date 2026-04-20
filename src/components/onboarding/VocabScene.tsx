import { useEffect, useState } from 'react';
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
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

type Props = { active: boolean };

const KASHMIRI = 'salaam';
const ENGLISH = 'hello';
const CYCLE = 5200;

export function VocabScene({ active }: Props) {
  const [kashTyped, setKashTyped] = useState('');
  const [engTyped, setEngTyped] = useState('');

  const micPulse = useSharedValue(0);
  const micActive = useSharedValue(0);
  const bars = [0, 1, 2, 3, 4, 5].map(() => useSharedValue(0.2));
  const saveOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    let timeouts: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) =>
      timeouts.push(setTimeout(fn, ms));

    const run = () => {
      // Reset
      setKashTyped('');
      setEngTyped('');
      micPulse.value = 0;
      micActive.value = 0;
      saveOpacity.value = 0;
      bars.forEach((b) => (b.value = 0.2));

      // Type Kashmiri char by char
      [...KASHMIRI].forEach((_, i) => {
        schedule(() => setKashTyped(KASHMIRI.slice(0, i + 1)), 200 + i * 140);
      });

      // Type English char by char
      const engStart = 200 + KASHMIRI.length * 140 + 400;
      [...ENGLISH].forEach((_, i) => {
        schedule(() => setEngTyped(ENGLISH.slice(0, i + 1)), engStart + i * 110);
      });

      // Activate mic
      const micStart = engStart + ENGLISH.length * 110 + 400;
      schedule(() => {
        micActive.value = withTiming(1, { duration: 300 });
        micPulse.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) })
          ),
          2,
          false
        );
        bars.forEach((b, i) => {
          b.value = withDelay(
            i * 50,
            withRepeat(
              withSequence(
                withTiming(0.9, { duration: 200 + (i % 3) * 60, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.25, { duration: 200 + (i % 3) * 60, easing: Easing.inOut(Easing.sin) })
              ),
              5,
              false
            )
          );
        });
      }, micStart);

      // Save confirmation
      schedule(() => {
        micActive.value = withTiming(0, { duration: 200 });
        saveOpacity.value = withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(600, withTiming(0, { duration: 300 }))
        );
      }, micStart + 1400);
    };

    run();
    const interval = setInterval(run, CYCLE);
    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [active]);

  const micActiveStyle = useAnimatedStyle(() => ({
    backgroundColor:
      micActive.value > 0.5 ? Colors.wrong : Colors.textLight,
    transform: [{ scale: 1 + micPulse.value * 0.1 }],
  }));

  const micRingStyle = useAnimatedStyle(() => ({
    opacity: micPulse.value * 0.5,
    transform: [{ scale: 1 + micPulse.value * 0.8 }],
  }));

  const saveStyle = useAnimatedStyle(() => ({
    opacity: saveOpacity.value,
    transform: [{ translateY: (1 - saveOpacity.value) * 10 }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.inputRow}>
          <Text style={styles.label}>Koshur</Text>
          <View style={styles.input}>
            <Text style={styles.kashText}>{kashTyped}</Text>
            <View style={styles.caret} />
          </View>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>English</Text>
          <View style={styles.input}>
            <Text style={styles.engText}>{engTyped}</Text>
          </View>
        </View>

        <View style={styles.micRow}>
          <View style={styles.micWrap}>
            <Animated.View style={[styles.micRing, micRingStyle]} />
            <Animated.View style={[styles.micBtn, micActiveStyle]}>
              <SymbolView name={{ ios: 'mic.fill', android: 'mic', web: 'mic' } as any} tintColor="#fff" size={18} />
            </Animated.View>
          </View>
          <View style={styles.waveform}>
            {bars.map((b, i) => (
              <AnimatedBar key={i} sv={b} />
            ))}
          </View>
          <Animated.View style={[styles.savePill, saveStyle]}>
            <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' } as any} tintColor="#fff" size={12} />
            <Text style={styles.saveText}>Saved</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function AnimatedBar({ sv }: { sv: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    height: 6 + sv.value * 28,
  }));
  return <Animated.View style={[styles.bar, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: 300,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 290,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  inputRow: {
    gap: 4,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bodySemi,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kashText: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: FontFamily.heading,
  },
  engText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  caret: {
    width: 2,
    height: 18,
    backgroundColor: Colors.primary,
    marginLeft: 2,
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  micWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.wrong,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 3,
  },
  bar: {
    width: 5,
    backgroundColor: Colors.secondary,
    borderRadius: 2.5,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.correct,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  saveText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
