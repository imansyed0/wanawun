import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/src/constants/theme';

const RECORD_RED = '#D9463B';

interface CircleButtonProps {
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * Classic record control: a red dot inside a circular button when idle,
 * a red rounded square ("stop") with a pulsing ring while recording.
 */
export function RecordButton({
  recording,
  onPress,
  size = 34,
  disabled,
  style,
  accessibilityLabel,
}: CircleButtonProps & { recording: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const dot = Math.round(size * 0.38);
  const square = Math.round(size * 0.34);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (recording ? 'Stop recording' : 'Record audio')}
      style={({ pressed }) => [
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: recording ? RECORD_RED : Colors.border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {recording ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
            },
          ]}
        />
      ) : null}
      {recording ? (
        <View style={{ width: square, height: square, borderRadius: 3, backgroundColor: RECORD_RED }} />
      ) : (
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: RECORD_RED }} />
      )}
    </Pressable>
  );
}

/** Play (triangle) / stop (square) circular button drawn with Views. */
export function PlayButton({
  playing,
  onPress,
  size = 34,
  disabled,
  style,
  accessibilityLabel,
}: CircleButtonProps & { playing: boolean }) {
  const tri = Math.round(size * 0.2);
  const square = Math.round(size * 0.3);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (playing ? 'Stop playback' : 'Play audio')}
      style={({ pressed }) => [
        styles.circle,
        styles.playCircle,
        { width: size, height: size, borderRadius: size / 2 },
        playing && styles.playCircleActive,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {playing ? (
        <View style={{ width: square, height: square, borderRadius: 2, backgroundColor: '#fff' }} />
      ) : (
        <View
          style={{
            width: 0,
            height: 0,
            marginLeft: Math.round(tri * 0.35),
            borderTopWidth: tri * 0.85,
            borderBottomWidth: tri * 0.85,
            borderLeftWidth: tri * 1.3,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: Colors.primaryDark,
          }}
        />
      )}
    </Pressable>
  );
}

/** Small "0:07" elapsed-time label that ticks while `active`. */
export function RecordingTimer({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return (
    <View style={styles.timerWrap}>
      <View style={styles.timerDot} />
      <Text style={styles.timerText}>{`${m}:${s}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
  },
  playCircle: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.surfaceLight,
  },
  playCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: RECORD_RED,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECORD_RED,
  },
  timerText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemi,
    color: RECORD_RED,
    fontVariant: ['tabular-nums'],
    minWidth: 28,
  },
});
