import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Grandmother } from '@/src/components/onboarding/Grandmother';
import { Button } from '@/src/components/ui/Button';
import { Colors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { allCourses, recommendedCourseId } from '@/src/data/courses';
import {
  LEVEL_LABELS,
  saveLearnerLevel,
  type LearnerLevel,
} from '@/src/services/starterGlossaryService';

// Titles come from LEVEL_LABELS, which the course cards badge themselves with:
// the answer given here and the label on the recommended course are then the
// same words rather than two descriptions of the same level.
const OPTIONS: { level: LearnerLevel; description: string }[] = [
  {
    level: 'beginner',
    description: 'Starting from scratch. Maybe there’s someone Kashmiri you’d love to impress.',
  },
  {
    level: 'intermediate',
    description: 'You know bits and pieces from home and want to reconnect with your roots.',
  },
  {
    level: 'understands',
    description: 'You follow most of what’s said. You just want to answer back without feeling embarrassed.',
  },
];

/**
 * Naani's first question. The answer picks the learner's starter words, so it
 * comes before the account is made (or, for an account that never answered,
 * straight after signing in).
 */
export default function LevelScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<LearnerLevel | null>(null);
  const [saving, setSaving] = useState(false);

  // The course their answer points them at, so the choice means something
  // before they've even signed up. The Lessons list marks the same one.
  const startHere = selected
    ? allCourses.find((course) => course.id === recommendedCourseId(selected))
    : undefined;

  async function handleContinue() {
    if (!selected || saving || loading) return;
    setSaving(true);
    try {
      await saveLearnerLevel(selected, user?.id);
    } catch {
      // Not fatal: without an answer the starter words default to beginner.
    }
    setSaving(false);

    if (user) {
      // Already signed in (e.g. an existing account on a new phone): carry on into the app.
      router.replace('/');
    } else {
      router.push('/auth/register');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.naaniRow}>
          <Grandmother pose="point" size={84} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              Before we start, tell me how much Koshur you know already.
            </Text>
          </View>
        </View>

        <View style={styles.options} accessibilityRole="radiogroup">
          {OPTIONS.map((option) => {
            const isSelected = selected === option.level;
            return (
              <Pressable
                key={option.level}
                onPress={() => setSelected(option.level)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{LEVEL_LABELS[option.level].title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {startHere ? (
          <View style={styles.startHere}>
            <Text style={styles.startHereLabel}>Naani says: start here</Text>
            <Text style={styles.startHereTitle}>{startHere.title}</Text>
            <Text style={styles.startHereAuthor}>{startHere.author}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={saving ? 'Saving...' : 'Continue'}
          size="lg"
          onPress={handleContinue}
          disabled={!selected || saving || loading}
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  naaniRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  bubble: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bubbleText: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
    fontFamily: FontFamily.bodySemi,
  },
  options: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F3F7F5',
  },
  optionPressed: {
    opacity: 0.85,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
  },
  optionDescription: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    color: Colors.textSecondary,
  },
  startHere: {
    backgroundColor: '#F3F7F5',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Spacing.md,
    gap: 2,
  },
  startHereLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  startHereTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.text,
  },
  startHereAuthor: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
});
