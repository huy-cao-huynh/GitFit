import { useEffect } from 'react';
import Animated, { interpolateColor, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Rect } from 'react-native-svg';

import { Colors, Palette } from '@/constants/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const VIEW_WIDTH = 80;
const VIEW_HEIGHT = 140;
const BODY_TOP = 34;
const BODY_HEIGHT = VIEW_HEIGHT - BODY_TOP;
const BODY_WIDTH = 60;
const BODY_X = (VIEW_WIDTH - BODY_WIDTH) / 2;

/** Hand-rolled SVG bottle that fills from the bottom as `progress` increases — same rig as ActivityRings. */
export function WaterBottle({ progress, size = 120 }: { progress: number; size?: number }) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 500 });
  }, [clamped, fill]);

  const animatedProps = useAnimatedProps(() => {
    const height = BODY_HEIGHT * fill.value;
    return {
      height,
      y: BODY_TOP + BODY_HEIGHT - height,
      fill: interpolateColor(fill.value, [0, 1], [Palette.orange, Colors.accent]),
    };
  });

  return (
    <Svg width={size} height={(size * VIEW_HEIGHT) / VIEW_WIDTH} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
      <Defs>
        <ClipPath id="bottleBody">
          <Rect x={BODY_X} y={BODY_TOP} width={BODY_WIDTH} height={BODY_HEIGHT} rx={14} />
        </ClipPath>
      </Defs>

      {/* cap + neck */}
      <Rect x={VIEW_WIDTH / 2 - 8} y={0} width={16} height={10} rx={2} fill={Colors.backgroundSelected} />
      <Rect x={VIEW_WIDTH / 2 - 12} y={10} width={24} height={20} rx={4} fill="none" stroke={Colors.backgroundSelected} strokeWidth={3} />

      {/* body outline */}
      <Rect
        x={BODY_X}
        y={BODY_TOP}
        width={BODY_WIDTH}
        height={BODY_HEIGHT}
        rx={14}
        fill="none"
        stroke={Colors.backgroundSelected}
        strokeWidth={3}
      />

      {/* animated fill, clipped to the body */}
      <AnimatedRect x={BODY_X} width={BODY_WIDTH} fill={Palette.orange} clipPath="url(#bottleBody)" animatedProps={animatedProps} />
    </Svg>
  );
}
