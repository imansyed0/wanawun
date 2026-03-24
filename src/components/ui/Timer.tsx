import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';

interface TimerProps {
  durationMs: number;
  onTimeout: () => void;
  isRunning: boolean;
}

export function Timer({ durationMs, onTimeout, isRunning }: TimerProps) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    setRemaining(durationMs);
  }, [durationMs]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 100) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, onTimeout]);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = remaining / durationMs;
  const isUrgent = fraction < 0.3;

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${fraction * 100}%`,
              backgroundColor: isUrgent ? Colors.wrong : Colors.timer,
            },
          ]}
        />
      </View>
      <Text style={[styles.text, isUrgent && styles.textUrgent]}>
        {seconds}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 32,
    textAlign: 'right',
  },
  textUrgent: {
    color: Colors.wrong,
  },
});
