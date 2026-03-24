import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Colors } from '@/src/constants/theme';

interface PaisleyBorderProps {
  width?: number;
  color?: string;
  opacity?: number;
}

/**
 * A delicate paisley-inspired border line, referencing the Kashmiri "buta" motif
 * found on pashmina shawls and pheran embroidery.
 */
export function PaisleyBorder({
  width = 300,
  color = Colors.secondary,
  opacity = 0.2,
}: PaisleyBorderProps) {
  const h = 16;
  const repeat = Math.ceil(width / 48);

  return (
    <Svg width={width} height={h} viewBox={`0 0 ${repeat * 48} ${h}`}>
      {Array.from({ length: repeat }).map((_, i) => (
        <G key={i} transform={`translate(${i * 48}, 0)`}>
          {/* Small paisley/teardrop */}
          <Path
            d="M12 2 C6 4 4 10 8 13 C12 16 18 12 16 8 C14 4 12 2 12 2 Z"
            fill={color}
            opacity={opacity}
          />
          <Circle cx={24} cy={8} r={1.5} fill={color} opacity={opacity * 0.6} />
          {/* Mirrored paisley */}
          <Path
            d="M36 2 C42 4 44 10 40 13 C36 16 30 12 32 8 C34 4 36 2 36 2 Z"
            fill={color}
            opacity={opacity}
          />
        </G>
      ))}
    </Svg>
  );
}

interface ScreenHeaderDecorationProps {
  variant?: 'saffron' | 'green' | 'teal';
}

/**
 * Subtle decorative accent for screen headers — a thin gradient-like
 * band with paisley motifs, inspired by the borders on Kashmiri shawls.
 */
export function ScreenHeaderDecoration({ variant = 'green' }: ScreenHeaderDecorationProps) {
  const colorMap = {
    saffron: Colors.secondary,
    green: Colors.primary,
    teal: Colors.accent,
  };
  const color = colorMap[variant];

  return (
    <View style={styles.decorationRow}>
      <View style={[styles.decorLine, { backgroundColor: color }]} />
      <PaisleyBorder width={120} color={color} opacity={0.35} />
      <View style={[styles.decorLine, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  decorationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  decorLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
});
