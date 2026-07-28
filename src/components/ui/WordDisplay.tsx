import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, LineHeight, Spacing } from '@/src/constants/theme';

interface WordDisplayProps {
  kashmiri: string;
  english?: string;
  showEnglish?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function WordDisplay({
  kashmiri,
  english,
  showEnglish = false,
  size = 'md',
}: WordDisplayProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.kashmiri, styles[`kashmiri_${size}`]]}>
        {kashmiri}
      </Text>
      {showEnglish && english && (
        <Text style={[styles.english, styles[`english_${size}`]]}>
          {english}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  kashmiri: {
    fontFamily: FontFamily.kashmiri,
    color: Colors.accent,
    letterSpacing: 1,
    textAlign: 'center',
  },
  kashmiri_sm: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.kashmiri(FontSize.lg),
  },
  kashmiri_md: {
    fontSize: FontSize.xxl,
    lineHeight: LineHeight.kashmiri(FontSize.xxl),
  },
  kashmiri_lg: {
    fontSize: FontSize.title,
    lineHeight: LineHeight.kashmiri(FontSize.title),
  },
  english: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  english_sm: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
  },
  english_md: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
  },
  english_lg: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.body(FontSize.lg),
  },
});
