import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';
import { markOnboardingSeen } from '@/src/services/onboardingService';
import { WelcomeScene } from '@/src/components/onboarding/WelcomeScene';
import { LessonsScene } from '@/src/components/onboarding/LessonsScene';
import { VocabScene } from '@/src/components/onboarding/VocabScene';
import { GlossaryScene } from '@/src/components/onboarding/GlossaryScene';
import { FlashcardsScene } from '@/src/components/onboarding/FlashcardsScene';
import { ClashScene } from '@/src/components/onboarding/ClashScene';

import type { ComponentType } from 'react';

type Slide = {
  key: string;
  title: string;
  body: string;
  Scene: ComponentType<{ active: boolean }>;
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: 'Welcome to Wanawun',
    body: 'Learn Kashmiri through audio lessons, vocabulary practice, flashcards, and live games with other learners.',
    Scene: WelcomeScene,
  },
  {
    key: 'lessons',
    title: 'Listen to audio lessons',
    body: 'Tap a clip to hear a native speaker. Every clip you finish gets ticked — complete them all to finish the lesson.',
    Scene: LessonsScene,
  },
  {
    key: 'vocab',
    title: 'Save words & record yourself',
    body: 'Type the Kashmiri and English, record your own voice, and save it to your glossary without leaving the lesson.',
    Scene: VocabScene,
  },
  {
    key: 'glossary',
    title: 'Your personal dictionary',
    body: 'Every word you save appears in the Glossary — tap any entry to replay audio and practise on the go.',
    Scene: GlossaryScene,
  },
  {
    key: 'flashcards',
    title: 'Flip through flashcards',
    body: 'Drill your saved words, flip to reveal the meaning, and rate how well you knew it. The app resurfaces the tricky ones.',
    Scene: FlashcardsScene,
  },
  {
    key: 'play',
    title: 'Koshur Clash',
    body: 'Go head-to-head with other learners. Answer faster, win the round, and climb the rating board.',
    Scene: ClashScene,
  },
  {
    key: 'ready',
    title: "You're ready to go",
    body: 'Start with a lesson, save a word, and come back any time from your Profile tab.',
    Scene: WelcomeScene,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1' || replay === 'true';

  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      goTo(index + 1);
    }
  };

  const finish = async () => {
    if (!isReplay) {
      try {
        await markOnboardingSeen();
      } catch {
        // non-fatal
      }
      router.replace('/lessons');
    } else {
      router.back();
    }
  };

  const handleSkip = () => {
    finish();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {index + 1} / {SLIDES.length}
        </Text>
        {!isLast ? (
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, i) => {
          const Scene = slide.Scene;
          return (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <View style={styles.sceneWrap}>
                <Scene active={i === index} />
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => goTo(i)}
            hitSlop={8}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title={isLast ? (isReplay ? 'Done' : 'Get started') : 'Next'}
          onPress={handleNext}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  counter: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  skipText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  sceneWrap: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 520,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 22,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
});
