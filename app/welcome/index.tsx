import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '@/src/constants/theme';

/**
 * The app's front door for anyone signed out: Naani says hello, then new
 * learners go on to her level question and existing ones go to sign in.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stage}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleTitle}>Salaam, jaanu. I’m Naani.</Text>
          <Text style={styles.bubbleText}>
            Come, we’ll learn Koshur together!
          </Text>
        </View>
        <View style={styles.bubbleTail} />
        <Grandmother pose="wave" size={200} />
      </View>

      <View style={styles.actions}>
        <Button
          title="Get started"
          size="lg"
          onPress={() => router.push('/welcome/level' as Href)}
        />
        <Button
          title="I already have an account"
          variant="ghost"
          onPress={() => router.push('/auth/login')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: 340,
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  bubbleTail: {
    width: 16,
    height: 16,
    marginTop: -9,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    transform: [{ rotate: '45deg' }],
  },
  bubbleTitle: {
    fontFamily: FontFamily.heading,
    // One size down so "Salaam, jaanu. I’m Naani." stays on one line on phones.
    fontSize: FontSize.lg,
    lineHeight: LineHeight.heading(FontSize.lg),
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  bubbleText: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
});
