import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { Colors } from '@/src/constants/theme';

export type GrandmotherPose = 'kangri' | 'wave' | 'point' | 'cheer';

type Props = {
  pose?: GrandmotherPose;
  size?: number;
};

const SKIN = '#E2B08A';
const SKIN_SHADE = '#D19E76';
const SCARF = '#F7F4EA';
const SCARF_EDGE = '#E4DEC9';
const PHERAN = Colors.wrong; // muted chinar red
const PHERAN_DARK = '#A05248';
const TRIM = Colors.secondary; // saffron
const FACE_LINE = '#5B4636';
const KANGRI_POT = '#8B6B4A';
const KANGRI_WEAVE = '#B9906B';

/**
 * Naani — a stylised Kashmiri grandmother in a pheran and headscarf,
 * holding a kangri. Poses swap out the arm shapes.
 */
export function Grandmother({ pose = 'kangri', size = 200 }: Props) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [bob]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * 4 },
      { rotate: `${(bob.value - 0.5) * 1.6}deg` },
    ],
  }));

  const cheerful = pose === 'cheer';

  return (
    <Animated.View style={bobStyle}>
      <Svg width={size} height={size * (240 / 220)} viewBox="0 0 220 240">
        {/* Pheran body */}
        <Path
          d="M78 108 Q110 96 142 108 L166 210 Q168 226 150 228 L70 228 Q52 226 54 210 Z"
          fill={PHERAN}
        />
        {/* Hem trim */}
        <Path
          d="M57 206 L163 206 L166 214 Q168 226 150 228 L70 228 Q52 226 54 214 Z"
          fill={TRIM}
          opacity={0.9}
        />
        {/* Neckline trim */}
        <Path
          d="M94 108 L110 128 L126 108"
          stroke={TRIM}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        {/* Tilla embroidery dots */}
        <Circle cx={80} cy={150} r={2.4} fill={TRIM} opacity={0.8} />
        <Circle cx={140} cy={150} r={2.4} fill={TRIM} opacity={0.8} />
        <Circle cx={72} cy={182} r={2.4} fill={TRIM} opacity={0.8} />
        <Circle cx={148} cy={182} r={2.4} fill={TRIM} opacity={0.8} />
        <Circle cx={110} cy={168} r={2.4} fill={TRIM} opacity={0.8} />

        {/* Arms */}
        {pose === 'kangri' && (
          <G>
            <Path
              d="M80 118 Q66 150 96 162"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M140 118 Q154 150 124 162"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={99} cy={163} r={8} fill={SKIN} />
            <Circle cx={121} cy={163} r={8} fill={SKIN} />
          </G>
        )}
        {pose === 'wave' && (
          <G>
            <Path
              d="M80 118 Q66 150 96 162"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={99} cy={163} r={8} fill={SKIN} />
            <Path
              d="M140 118 Q166 108 172 88"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={174} cy={82} r={9} fill={SKIN} />
            {/* waving fingers hint */}
            <Path
              d="M170 74 Q174 70 178 74"
              stroke={SKIN_SHADE}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}
        {pose === 'point' && (
          <G>
            <Path
              d="M80 118 Q66 150 96 162"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={99} cy={163} r={8} fill={SKIN} />
            <Path
              d="M140 118 Q166 124 180 132"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={185} cy={134} r={8} fill={SKIN} />
          </G>
        )}
        {pose === 'cheer' && (
          <G>
            <Path
              d="M82 118 Q58 106 50 88"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M138 118 Q162 106 170 88"
              stroke={PHERAN_DARK}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={47} cy={82} r={9} fill={SKIN} />
            <Circle cx={173} cy={82} r={9} fill={SKIN} />
          </G>
        )}

        {/* Kangri (fire pot) — only in kangri pose */}
        {pose === 'kangri' && (
          <G>
            <Path
              d="M96 168 Q110 146 124 168"
              stroke={KANGRI_WEAVE}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
            />
            <Ellipse cx={110} cy={180} rx={17} ry={13} fill={KANGRI_POT} />
            <Ellipse cx={110} cy={170} rx={13} ry={4.5} fill="#6E5236" />
            <Circle cx={110} cy={169} r={3.4} fill="#E8956B" opacity={0.9} />
            {/* wicker lattice */}
            <Path
              d="M96 176 Q110 184 124 176 M97 184 Q110 192 123 184"
              stroke={KANGRI_WEAVE}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}

        {/* Headscarf back drape */}
        <Path
          d="M74 66 Q70 104 84 116 L110 112 L136 116 Q150 104 146 66 Z"
          fill={SCARF}
          stroke={SCARF_EDGE}
          strokeWidth={1.5}
        />
        {/* Head */}
        <Circle cx={110} cy={74} r={31} fill={SKIN} />
        {/* Scarf over hair */}
        <Path
          d="M79 76 Q75 36 110 34 Q145 36 141 76 Q141 60 110 56 Q79 60 79 76 Z"
          fill={SCARF}
          stroke={SCARF_EDGE}
          strokeWidth={1.5}
        />
        {/* Grey hair peeking */}
        <Path
          d="M92 58 Q110 52 128 58"
          stroke="#C9C4B6"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />

        {/* Dejhoor earrings */}
        <Line x1={81} y1={84} x2={81} y2={94} stroke={TRIM} strokeWidth={2} />
        <Circle cx={81} cy={97} r={3.2} fill={TRIM} />
        <Line x1={139} y1={84} x2={139} y2={94} stroke={TRIM} strokeWidth={2} />
        <Circle cx={139} cy={97} r={3.2} fill={TRIM} />

        {/* Glasses */}
        <Circle cx={98} cy={74} r={9.5} stroke={Colors.walnut} strokeWidth={2} fill="none" />
        <Circle cx={122} cy={74} r={9.5} stroke={Colors.walnut} strokeWidth={2} fill="none" />
        <Line x1={107.5} y1={74} x2={112.5} y2={74} stroke={Colors.walnut} strokeWidth={2} />

        {/* Eyes — happy closed arcs when cheering */}
        {cheerful ? (
          <G>
            <Path d="M93 74 Q98 69 103 74" stroke={FACE_LINE} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Path d="M117 74 Q122 69 127 74" stroke={FACE_LINE} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Circle cx={98} cy={75} r={2.6} fill={FACE_LINE} />
            <Circle cx={122} cy={75} r={2.6} fill={FACE_LINE} />
          </G>
        )}

        {/* Rosy cheeks */}
        <Ellipse cx={90} cy={87} rx={5} ry={3.2} fill="#DE8F7F" opacity={0.5} />
        <Ellipse cx={130} cy={87} rx={5} ry={3.2} fill="#DE8F7F" opacity={0.5} />

        {/* Nose */}
        <Path d="M108 80 Q110 85 112 80" stroke={SKIN_SHADE} strokeWidth={2} fill="none" strokeLinecap="round" />

        {/* Smile */}
        {cheerful ? (
          <Path
            d="M100 91 Q110 102 120 91 Z"
            fill="#9C5A50"
          />
        ) : (
          <Path
            d="M101 92 Q110 99 119 92"
            stroke={FACE_LINE}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Smile lines (she's earned them) */}
        <Path d="M96 90 Q94 92 94 95" stroke={SKIN_SHADE} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Path d="M124 90 Q126 92 126 95" stroke={SKIN_SHADE} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
