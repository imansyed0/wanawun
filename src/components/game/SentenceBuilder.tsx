import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import type { WordEntry, SentenceTemplate, SentenceSlot } from '@/src/types';

interface SentenceBuilderProps {
  template: SentenceTemplate;
  wordOptions: { [position: number]: WordEntry[] }; // words for each slot
  onComplete: (
    filledWords: { position: number; word: WordEntry }[],
    trapPosition: number,
    trapWord: WordEntry
  ) => void;
}

type BuildPhase = 'filling' | 'picking_trap' | 'picking_swap';

export function SentenceBuilder({ template, wordOptions, onComplete }: SentenceBuilderProps) {
  const [phase, setPhase] = useState<BuildPhase>('filling');
  const [filledSlots, setFilledSlots] = useState<{ [position: number]: WordEntry }>({});
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [trapPosition, setTrapPosition] = useState<number | null>(null);
  const [trapWord, setTrapWord] = useState<WordEntry | null>(null);

  const allSlotsFilled = template.slots.every(s => filledSlots[s.position]);

  function handleWordSelect(position: number, word: WordEntry) {
    setFilledSlots(prev => ({ ...prev, [position]: word }));
    setActiveSlot(null);
  }

  function handleTrapSelect(position: number) {
    setTrapPosition(position);
    setPhase('picking_swap');
  }

  function handleSwapSelect(word: WordEntry) {
    if (trapPosition === null) return;
    setTrapWord(word);

    // Build final result
    const filledWords = template.slots.map(s => ({
      position: s.position,
      word: filledSlots[s.position],
    }));

    onComplete(filledWords, trapPosition, word);
  }

  // Render the sentence with slots
  function renderSentence() {
    const parts = template.template.split('___');
    const elements: React.ReactNode[] = [];

    parts.forEach((part, i) => {
      if (part) {
        elements.push(
          <Text key={`text-${i}`} style={styles.sentenceText}>
            {part}
          </Text>
        );
      }
      if (i < template.slots.length) {
        const slot = template.slots[i];
        const filled = filledSlots[slot.position];
        const isTrap = trapPosition === slot.position;

        elements.push(
          <Pressable
            key={`slot-${i}`}
            style={[
              styles.slot,
              filled && styles.slotFilled,
              activeSlot === slot.position && styles.slotActive,
              isTrap && styles.slotTrap,
            ]}
            onPress={() => {
              if (phase === 'filling') setActiveSlot(slot.position);
              else if (phase === 'picking_trap') handleTrapSelect(slot.position);
            }}
          >
            <Text
              style={[
                styles.slotText,
                filled && styles.slotTextFilled,
                isTrap && styles.slotTextTrap,
              ]}
            >
              {isTrap && trapWord ? trapWord.kashmiri : filled?.kashmiri ?? `[${slot.type}]`}
            </Text>
          </Pressable>
        );
      }
    });

    return <View style={styles.sentenceRow}>{elements}</View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.phaseLabel}>
        {phase === 'filling'
          ? 'Fill in the blanks'
          : phase === 'picking_trap'
            ? 'Tap a word to make it the TRAP'
            : 'Pick a wrong word to swap in'}
      </Text>

      <Text style={styles.englishTemplate}>{template.english_template}</Text>

      <View style={styles.sentenceContainer}>{renderSentence()}</View>

      {/* Word picker for active slot */}
      {phase === 'filling' && activeSlot !== null && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.wordPicker}
          >
            {(wordOptions[activeSlot] ?? []).map(word => (
              <Pressable
                key={word.id}
                style={styles.wordOption}
                onPress={() => handleWordSelect(activeSlot, word)}
              >
                <Text style={styles.wordOptionKashmiri}>{word.kashmiri}</Text>
                <Text style={styles.wordOptionEnglish}>{word.english}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Swap word picker */}
      {phase === 'picking_swap' && trapPosition !== null && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={styles.swapLabel}>Pick a wrong word:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.wordPicker}
          >
            {(wordOptions[trapPosition] ?? [])
              .filter(w => w.id !== filledSlots[trapPosition]?.id)
              .slice(0, 6)
              .map(word => (
                <Pressable
                  key={word.id}
                  style={[styles.wordOption, styles.wordOptionTrap]}
                  onPress={() => handleSwapSelect(word)}
                >
                  <Text style={styles.wordOptionKashmiri}>{word.kashmiri}</Text>
                  <Text style={styles.wordOptionEnglish}>{word.english}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Continue button after filling */}
      {phase === 'filling' && allSlotsFilled && activeSlot === null && (
        <Button
          title="Now pick the trap word"
          onPress={() => setPhase('picking_trap')}
        />
      )}
    </View>
  );
}

// Local Button for this component
function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.continueBtn} onPress={onPress}>
      <Text style={styles.continueBtnText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  phaseLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  englishTemplate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sentenceContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 80,
    justifyContent: 'center',
  },
  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  sentenceText: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: '500',
  },
  slot: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  slotFilled: {
    borderColor: Colors.primary,
    borderStyle: 'solid',
    backgroundColor: '#E8F5E9',
  },
  slotActive: {
    borderColor: Colors.secondary,
    backgroundColor: '#FFF3E0',
  },
  slotTrap: {
    borderColor: Colors.wrong,
    backgroundColor: '#FFEBEE',
  },
  slotText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
  },
  slotTextFilled: {
    color: Colors.accent,
    fontWeight: '700',
  },
  slotTextTrap: {
    color: Colors.wrong,
    fontWeight: '700',
  },
  wordPicker: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  wordOption: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minWidth: 100,
  },
  wordOptionTrap: {
    borderColor: Colors.wrong,
  },
  wordOptionKashmiri: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent,
  },
  wordOptionEnglish: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  swapLabel: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
    fontWeight: '600',
  },
  continueBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
});
