import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import type { MessengerTurn } from '@/src/types';

interface TrapSpotterProps {
  turn: MessengerTurn;
  onSubmit: (trapGuess: number, translation: string, correctWord?: string) => void;
}

export function TrapSpotter({ turn, onSubmit }: TrapSpotterProps) {
  const [selectedTrap, setSelectedTrap] = useState<number | null>(null);
  const [translation, setTranslation] = useState('');
  const [correctWord, setCorrectWord] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (selectedTrap === null || !translation.trim()) return;
    setSubmitted(true);
    onSubmit(selectedTrap, translation.trim(), correctWord.trim() || undefined);
  }

  // Parse the sentence and highlight words
  const words = turn.filled_words;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spot the Trap!</Text>
      <Text style={styles.subtitle}>
        Your opponent sent you a sentence. One word is WRONG — find it!
      </Text>

      {/* Sentence with tappable words */}
      <View style={styles.sentenceBox}>
        <Text style={styles.sentenceLabel}>The sentence:</Text>
        <Text style={styles.sentence}>{turn.filled_sentence}</Text>

        <View style={styles.wordGrid}>
          {words.map((w, i) => {
            const isSelected = selectedTrap === w.position;
            const isRevealed = submitted;
            const isActualTrap = submitted && w.position === turn.trap_position;
            const isWrongGuess = submitted && isSelected && w.position !== turn.trap_position;

            return (
              <Pressable
                key={i}
                style={[
                  styles.wordChip,
                  isSelected && !submitted && styles.wordChipSelected,
                  isActualTrap && styles.wordChipTrap,
                  isWrongGuess && styles.wordChipWrong,
                ]}
                onPress={() => !submitted && setSelectedTrap(w.position)}
              >
                <Text style={[
                  styles.wordChipKashmiri,
                  (isSelected || isActualTrap) && styles.wordChipTextSelected,
                ]}>
                  {w.kashmiri}
                </Text>
                <Text style={styles.wordChipEnglish}>{w.english}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Translation input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Your translation:</Text>
        <TextInput
          style={styles.input}
          placeholder="Translate the sentence to English..."
          placeholderTextColor={Colors.textLight}
          value={translation}
          onChangeText={setTranslation}
          multiline
          editable={!submitted}
        />
      </View>

      {/* Bonus: correct word */}
      {selectedTrap !== null && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>
            Bonus: What should the correct word be? (English)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="The correct English word..."
            placeholderTextColor={Colors.textLight}
            value={correctWord}
            onChangeText={setCorrectWord}
            editable={!submitted}
          />
        </Animated.View>
      )}

      {/* Results */}
      {submitted && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.results}>
          <Text style={styles.resultsTitle}>
            {selectedTrap === turn.trap_position ? 'You found the trap!' : 'Missed the trap!'}
          </Text>
          <Text style={styles.resultsDetail}>
            The trap was "{turn.filled_words.find(w => w.position === turn.trap_position)?.kashmiri}"
            — it should have been "{turn.correct_word.kashmiri}" ({turn.correct_word.english})
          </Text>
          <Text style={styles.pointsText}>
            +{turn.points_earned ?? 0} points
          </Text>
        </Animated.View>
      )}

      {!submitted && (
        <Button
          title="Submit"
          onPress={handleSubmit}
          disabled={selectedTrap === null || !translation.trim()}
          size="lg"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sentenceBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sentenceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1,
  },
  sentence: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.accent,
    lineHeight: 28,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  wordChip: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  wordChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: '#FFF3E0',
  },
  wordChipTrap: {
    borderColor: Colors.wrong,
    backgroundColor: '#FFEBEE',
  },
  wordChipWrong: {
    borderColor: Colors.textLight,
    backgroundColor: Colors.surfaceLight,
  },
  wordChipKashmiri: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  wordChipTextSelected: {
    color: Colors.secondary,
  },
  wordChipEnglish: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  inputSection: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 48,
  },
  results: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resultsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  resultsDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pointsText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
});
