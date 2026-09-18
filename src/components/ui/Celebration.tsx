import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { Colors } from '@/src/constants/theme';

const DEFAULT_WIDTH = 104;
const DEFAULT_HEIGHT = 120;
const PARTICLE_COUNT = 14;
const DURATION = 950;

const CONFETTI_COLORS = [
  Colors.secondary,
  Colors.secondaryLight,
  Colors.streak,
  Colors.primary,
  Colors.primaryLight,
  Colors.accent,
];

interface Particle {
  color: string;
  size: number;
  round: boolean;
  /** Sideways drift, in px, at the end of the flight. */
  dx: number;
  /** How high it flies before gravity takes over. */
  rise: number;
  /** How far it falls back after the peak. */
  fall: number;
  spin: number;
  /** Fraction of the flight this piece sits out, so they don't move as one. */
  delay: number;
}

function makeParticles(width: number, scale: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Fan the pieces out evenly-ish, then jitter, so the burst reads as a
    // spray rather than a ring.
    const spread = (i + Math.random() * 0.8) / PARTICLE_COUNT - 0.5;
    return {
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: (5 + Math.random() * 5) * scale,
      round: i % 3 === 0,
      dx: spread * width * 0.9,
      rise: (42 + Math.random() * 34) * scale,
      fall: (14 + Math.random() * 18) * scale,
      spin: (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 220),
      delay: Math.random() * 0.18,
    };
  });
}

/** The last burst played per caller, so remounts don't replay old confetti. */
const lastCelebrated = new Map<string, number>();

interface CelebrationProps {
  /**
   * Bumped once per thing worth celebrating; each new value fires a burst.
   * Zero means "nothing yet".
   */
  trigger: number;
  /**
   * Who is celebrating. Bursts are remembered per id, so a component that
   * unmounts and comes back doesn't replay a burst it has already shown.
   */
  id: string;
  /** Where to sit — the caller places this over whatever is being celebrated. */
  style?: any;
  width?: number;
  height?: number;
  /** Shrinks or grows the pieces and how far they fly. */
  scale?: number;
}

/**
 * A small party popper: a burst of confetti that flies up out of whatever it
 * is pinned over. Purely decorative — it never takes touches, and it flattens
 * to a gentle fade when the device asks for reduced motion.
 */
export function Celebration({
  trigger,
  id,
  style,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  scale = 1,
}: CelebrationProps) {
  const [burst, setBurst] = useState<{
    id: number;
    particles: Particle[];
    reduceMotion: boolean;
  } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0 || lastCelebrated.get(id) === trigger) return;
    lastCelebrated.set(id, trigger);
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        progress.stopAnimation();
        progress.setValue(0);
        setBurst({ id: trigger, particles: makeParticles(width, scale), reduceMotion });
        Animated.timing(progress, {
          toValue: 1,
          duration: reduceMotion ? 600 : DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) setBurst(null);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [trigger, id, width, scale, progress]);

  if (!burst) return null;

  return (
    <View style={[styles.burst, { width, height }, style]} pointerEvents="none">
      {burst.particles.map((p, i) => {
        // Each piece waits out its delay, then flies the rest of the window.
        const start = p.delay;
        const peak = start + (1 - start) * 0.55;
        const lift = burst.reduceMotion
          ? // Reduced motion: the pieces sit still in the shape of the burst and
            // only fade, so there's still a moment of colour but nothing flies.
            { transform: [{ translateX: p.dx * 0.7 }, { translateY: -p.rise * 0.6 }] }
          : {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, start, 1],
                    outputRange: [0, 0, p.dx],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, start, peak, 1],
                    outputRange: [0, 0, -p.rise, -p.rise + p.fall],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, start, 1],
                    outputRange: ['0deg', '0deg', `${p.spin}deg`],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, start, peak, 1],
                    outputRange: [0.3, 0.6, 1, 0.85],
                  }),
                },
              ],
            };
        return (
          <Animated.View
            key={`${burst.id}-${i}`}
            style={[
              styles.piece,
              {
                width: p.size,
                height: p.round ? p.size : p.size * 1.6,
                borderRadius: p.round ? p.size / 2 : 1.5,
                backgroundColor: p.color,
                marginLeft: -p.size / 2,
                opacity: progress.interpolate({
                  inputRange: [0, start, Math.min(start + 0.12, 0.99), 0.72, 1],
                  outputRange: [0, 0, 1, 1, 0],
                }),
              },
              lift,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
  },
  piece: {
    position: 'absolute',
    // Pieces start together at the bottom centre of the box — i.e. just above
    // whatever is being celebrated — and spray upwards from there.
    bottom: 0,
    left: '50%',
  },
});
