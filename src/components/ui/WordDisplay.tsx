import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

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
    fontFamily: FontFamily.heading,
    color: Colors.accent,
    letterSpacing: 1,
  },
  kashmiri_sm: {
    fontSize: FontSize.lg,
  },
  kashmiri_md: {
    fontSize: FontSize.xxl,
  },
  kashmiri_lg: {
    fontSize: FontSize.title,
  },
  english: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  english_sm: {
    fontSize: FontSize.sm,
  },
  english_md: {
    fontSize: FontSize.md,
  },
  english_lg: {
    fontSize: FontSize.lg,
  },
});
