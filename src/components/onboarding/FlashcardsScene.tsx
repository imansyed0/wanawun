import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

type Props = { active: boolean };

const CARDS = [
  { kash: 'salaam', eng: 'hello' },
  { kash: 'shukriya', eng: 'thank you' },
  { kash: 'aab', eng: 'water' },
];

const CYCLE = 4000;

export function FlashcardsScene({ active }: Props) {
  const [idx, setIdx] = useState(0);

  const flip = useSharedValue(0); // 0 = front, 1 = back
  const swipeX = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);
  const enter = useSharedValue(1);

  useEffect(() => {
    if (!active) return;

    const run = () => {
      flip.value = 0;
      swipeX.value = 0;
      swipeOpacity.value = 1;
      enter.value = 0;

      // Enter scale
      enter.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

      // Flip after delay
      flip.value = withDelay(
        900,
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) })
      );

      // Swipe away
      swipeX.value = withDelay(
        2400,
        withTiming(260, { duration: 500, easing: Easing.in(Easing.cubic) })
      );
      swipeOpacity.value = withDelay(
        2400,
        withTiming(0, { duration: 500 })
      );
    };

    run();
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      setIdx(counter % CARDS.length);
      run();
    }, CYCLE);

    return () => clearInterval(interval);
  }, [active]);

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(flip.value, [0, 1], [0, 180]);
    const opacity = flip.value < 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(flip.value, [0, 1], [-180, 0]);
    const opacity = flip.value >= 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipeX.value },
      { rotate: `${swipeX.value * 0.05}deg` },
      { scale: 0.9 + enter.value * 0.1 },
    ],
    opacity: swipeOpacity.value * enter.value,
  }));

  const card = CARDS[idx];

  return (
    <View style={styles.wrap}>
      {/* Stack shadow cards behind */}
      <View style={[styles.card, styles.stackCard, { transform: [{ translateY: 12 }, { scale: 0.94 }], opacity: 0.4 }]} />
      <View style={[styles.card, styles.stackCard, { transform: [{ translateY: 6 }, { scale: 0.97 }], opacity: 0.7 }]} />

      <Animated.View style={[styles.cardWrap, wrapStyle]}>
        <Animated.View style={[styles.card, styles.cardFront, frontStyle]}>
          <Text style={styles.cardLabel}>Koshur</Text>
          <Text style={styles.kash}>{card.kash}</Text>
          <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'autorenew', web: 'autorenew' } as any} tintColor={Colors.textLight} size={18} />
        </Animated.View>
        <Animated.View style={[styles.card, styles.cardBack, backStyle]}>
          <Text style={[styles.cardLabel, { color: '#fff', opacity: 0.7 }]}>English</Text>
          <Text style={styles.eng}>{card.eng}</Text>
          <View style={styles.ratingRow}>
            <View style={[styles.ratingDot, { backgroundColor: Colors.wrong }]} />
            <View style={[styles.ratingDot, { backgroundColor: Colors.timer }]} />
            <View style={[styles.ratingDot, { backgroundColor: Colors.correct }]} />
          </View>
        </Animated.View>
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
  cardWrap: {
    width: 200,
    height: 200,
  },
  card: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  stackCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFront: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardBack: {
    backgroundColor: Colors.primary,
  },
  cardLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kash: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  eng: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.bodyHeavy,
    color: '#fff',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ratingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
