import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/src/constants/theme';

interface ChinarLeafProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: any;
}

/**
 * Wanawun app logo — a stylized upward-pointing chevron/peak shape.
 * Matches the app icon (an "A"-like mountain peak with rounded ends).
 */
export function ChinarLeaf({
  size = 40,
  color = Colors.primary,
  opacity = 0.15,
  style,
}: ChinarLeafProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
    >
      {/* Upward-pointing chevron / mountain peak logo */}
      <Path
        d={[
          // Outer shape: start at top peak
          'M50 10',
          // Left leg outer edge going down-left
          'C47 10 45 14 43 18',
          'L15 68',
          // Rounded bottom-left cap
          'C12 74 14 80 20 82',
          'C26 84 30 80 32 76',
          // Left leg inner edge going up toward center
          'L44 54',
          // Inner V notch at bottom-center
          'L50 66',
          'L56 54',
          // Right leg inner edge going down
          'L68 76',
          // Rounded bottom-right cap
          'C70 80 74 84 80 82',
          'C86 80 88 74 85 68',
          // Right leg outer edge going up
          'L57 18',
          'C55 14 53 10 50 10',
          'Z',
        ].join(' ')}
        fill={color}
        opacity={opacity}
      />
    </Svg>
  );
}
