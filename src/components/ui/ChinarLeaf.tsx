import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/src/constants/theme';

interface ChinarLeafProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: any;
}

/**
 * Iconic Chinar (Platanus orientalis) leaf — the symbol of Kashmir.
 * A simplified 5-lobed maple-like silhouette.
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
      {/* Five-lobed chinar leaf silhouette */}
      <Path
        d="M50 2 C52 8 60 14 68 12 C74 11 78 6 80 2 C82 8 86 16 82 22 C78 28 72 28 68 30 C74 30 84 28 92 22 C90 30 86 40 78 44 C72 47 66 44 62 42 C66 48 72 58 74 66 C68 64 60 60 56 56 C58 64 60 76 58 86 C56 80 52 72 50 66 C48 72 44 80 42 86 C40 76 42 64 44 56 C40 60 32 64 26 66 C28 58 34 48 38 42 C34 44 28 47 22 44 C14 40 10 30 8 22 C16 28 26 30 32 30 C28 28 22 28 18 22 C14 16 18 8 20 2 C22 6 26 11 32 12 C40 14 48 8 50 2 Z"
        fill={color}
        opacity={opacity}
      />
      {/* Stem */}
      <Path
        d="M49 66 C49 72 48 82 47 98 L50 98 L53 98 C52 82 51 72 51 66 Z"
        fill={color}
        opacity={opacity * 0.8}
      />
    </Svg>
  );
}
