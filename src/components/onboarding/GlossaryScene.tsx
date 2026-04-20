import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

type Props = { active: boolean };

const INCOMING = [
  { kash: 'salaam', eng: 'hello' },
  { kash: 'shukriya', eng: 'thank you' },
  { kash: 'akh', eng: 'one' },
];

const CYCLE = 4200;

export function VocabRow({ kash, eng }: { kash: string; eng: string }) {
  return (
    <View style={styles.row}>
      <SymbolView name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' } as any} tintColor={Colors.primary} size={14} />
      <Text style={styles.kash}>{kash}</Text>
      <Text style={styles.eng}>{eng}</Text>
    </View>
  );
}

export function GlossaryScene({ active }: Props) {
  const [list, setList] = useState<typeof INCOMING>([
    { kash: 'kitaab', eng: 'book' },
    { kash: 'aab', eng: 'water' },
  ]);

  // Flying word position
  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyOpacity = useSharedValue(0);
  const flyScale = useSharedValue(0.9);
  const [flyWord, setFlyWord] = useState(INCOMING[0]);

  // Highlight first row after insert
  const highlight = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    let timeouts: ReturnType<typeof setTimeout>[] = [];
    let idx = 0;

    const schedule = (fn: () => void, ms: number) =>
      timeouts.push(setTimeout(fn, ms));

    const animateOne = () => {
      const word = INCOMING[idx % INCOMING.length];
      idx++;
      setFlyWord(word);

      // Reset
      flyX.value = 110;
      flyY.value = 140;
      flyOpacity.value = 0;
      flyScale.value = 0.7;
      highlight.value = 0;

      // Fly in
      flyOpacity.value = withTiming(1, { duration: 200 });
      flyScale.value = withTiming(1, { duration: 200 });
      flyX.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
      flyY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.back(1.2)) });

      // Land: fade out and insert into real list
      schedule(() => {
        flyOpacity.value = withTiming(0, { duration: 150 });
        setList((prev) => [word, ...prev].slice(0, 4));
        highlight.value = withSequence(
          withTiming(1, { duration: 250 }),
          withTiming(0, { duration: 600 })
        );
      }, 750);
    };

    animateOne();
    const interval = setInterval(animateOne, CYCLE);
    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, [active]);

  const flyStyle = useAnimatedStyle(() => ({
    opacity: flyOpacity.value,
    transform: [
      { translateX: flyX.value },
      { translateY: flyY.value },
      { scale: flyScale.value },
    ],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlight.value,
      [0, 1],
      ['rgba(142, 174, 162, 0)', 'rgba(142, 174, 162, 0.3)']
    ),
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.header}>Glossary</Text>
        <Animated.View style={[styles.rowWrap, highlightStyle]}>
          {list[0] && <VocabRow kash={list[0].kash} eng={list[0].eng} />}
        </Animated.View>
        {list.slice(1).map((w, i) => (
          <View key={`${w.kash}-${i}`} style={styles.rowWrap}>
            <VocabRow kash={w.kash} eng={w.eng} />
          </View>
        ))}
      </View>

      {/* Flying word */}
      <Animated.View style={[styles.flying, flyStyle]}>
        <View style={styles.flyPill}>
          <Text style={styles.flyKash}>{flyWord.kash}</Text>
          <Text style={styles.flyEng}>{flyWord.eng}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 300,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 280,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  rowWrap: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  kash: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    minWidth: 70,
  },
  eng: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  flying: {
    position: 'absolute',
    top: 34,
    left: 28,
  },
  flyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  flyKash: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: FontFamily.heading,
  },
  flyEng: {
    color: '#fff',
    fontSize: FontSize.sm,
    opacity: 0.9,
  },
});
