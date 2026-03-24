import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

interface MultipleChoiceProps {
  options: string[];
  correctAnswer: string;
  onAnswer: (answer: string, timeMs: number) => void;
  disabled?: boolean;
}

export function MultipleChoice({
  options,
  correctAnswer,
  onAnswer,
  disabled = false,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  function handleSelect(option: string) {
    if (selected || disabled) return;
    setSelected(option);
    const timeMs = Date.now() - startTime;
    onAnswer(option, timeMs);
  }

  function getOptionStyle(option: string) {
    if (!selected) return styles.option;
    if (option === correctAnswer) return [styles.option, styles.optionCorrect];
    if (option === selected && option !== correctAnswer) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDimmed];
  }

  function getOptionTextStyle(option: string) {
    if (!selected) return styles.optionText;
    if (option === correctAnswer) return [styles.optionText, styles.optionTextCorrect];
    if (option === selected && option !== correctAnswer) return [styles.optionText, styles.optionTextWrong];
    return [styles.optionText, styles.optionTextDimmed];
  }

  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <Animated.View
          key={`${index}-${option}`}
          entering={FadeIn.delay(index * 100).duration(300)}
        >
          <Pressable
            style={({ pressed }) => [
              ...([getOptionStyle(option)].flat()),
              pressed && !selected && styles.optionPressed,
            ]}
            onPress={() => handleSelect(option)}
            disabled={!!selected || disabled}
          >
            <Text style={styles.optionLabel}>
              {String.fromCharCode(65 + index)}
            </Text>
            <Text style={getOptionTextStyle(option)} numberOfLines={2}>
              {option}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionPressed: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  optionCorrect: {
    borderColor: Colors.correct,
    backgroundColor: '#E8F5E9',
  },
  optionWrong: {
    borderColor: Colors.wrong,
    backgroundColor: '#FFEBEE',
  },
  optionDimmed: {
    opacity: 0.5,
  },
  optionLabel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  optionText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  optionTextCorrect: {
    color: Colors.correct,
  },
  optionTextWrong: {
    color: Colors.wrong,
  },
  optionTextDimmed: {
    color: Colors.textLight,
  },
});
