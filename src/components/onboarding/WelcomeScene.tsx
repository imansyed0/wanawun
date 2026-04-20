import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors, FontFamily, FontSize, Spacing } from '@/src/constants/theme';

type Props = { active: boolean };

const PHRASES = [
  { translit: 'salaam', eng: 'hello' },
  { translit: 'shukriya', eng: 'thank you' },
  { translit: 'aab', eng: 'water' },
  { translit: 'dost', eng: 'friend' },
];

const CYCLE = 2600;

export function WelcomeScene({ active }: Props) {
  const float = useSharedValue(0);
  const scale = useSharedValue(1);
  const phraseOpacity = useSharedValue(0);
  const phraseY = useSharedValue(10);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;

    float.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    const run = () => {
      phraseOpacity.value = 0;
      phraseY.value = 10;
      phraseOpacity.value = withTiming(1, { duration: 400 });
      phraseY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
      phraseOpacity.value = withDelay(
        CYCLE - 500,
        withTiming(0, { duration: 400 })
      );
    };

    run();
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      setIdx(counter % PHRASES.length);
      run();
    }, CYCLE);

    return () => clearInterval(interval);
  }, [active, float, scale, phraseOpacity, phraseY]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: scale.value }],
  }));

  const phraseStyle = useAnimatedStyle(() => ({
    opacity: phraseOpacity.value,
    transform: [{ translateY: phraseY.value }],
  }));

  const phrase = PHRASES[idx];

  return (
    <View style={styles.wrap}>
      <Animated.View style={iconStyle}>
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.phraseWrap, phraseStyle]}>
        <Text style={styles.translitHero}>{phrase.translit}</Text>
        <View style={styles.translitRow}>
          <Text style={styles.eng}>{phrase.eng}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  icon: {
    width: 160,
    height: 160,
    borderRadius: 36,
  },
  phraseWrap: {
    alignItems: 'center',
    gap: 6,
    minHeight: 60,
  },
  translitHero: {
    fontSize: 36,
    fontFamily: FontFamily.headingBold,
    color: Colors.primaryDark,
  },
  translitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eng: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontFamily: FontFamily.bodyBold,
  },
});
