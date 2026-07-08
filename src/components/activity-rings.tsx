import { Fragment, useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

export interface ActivityRing {
  progress: number;
  color: string;
  trackColor: string;
}

export interface ActivityRingsProps {
  rings: ActivityRing[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  animated?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Concentric progress rings, outermost ring first. Ring spacing shrinks to fit however many rings are passed in, so a 4th ring never collapses to a dot. */
export function ActivityRings({ rings, size = 128, strokeWidth = 11, gap = 3, animated = false }: ActivityRingsProps) {
  const viewBoxSize = 160;
  const center = viewBoxSize / 2;
  const outerRadius = center - strokeWidth / 2 - 6;
  // Innermost ring must stay meaningfully bigger than its own stroke width, or the hole in the
  // middle disappears and the "ring" reads as a solid dot instead of a progress arc.
  const minRadius = 20;
  const maxStep = strokeWidth + gap;
  const step = rings.length > 1 ? Math.min(maxStep, (outerRadius - minRadius) / (rings.length - 1)) : maxStep;
  const ringGap = Math.min(gap, step * 0.35);
  const ringStrokeWidth = Math.max(6, Math.min(strokeWidth, step - ringGap));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ transform: [{ rotate: '-90deg' }] }}>
      {rings.map((ring, index) => {
        const radius = outerRadius - index * step;
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(Math.max(ring.progress, 0), 1);

        return (
          <Fragment key={index}>
            <Circle cx={center} cy={center} r={radius} fill="none" stroke={ring.trackColor} strokeWidth={ringStrokeWidth} />
            <ProgressCircle
              animated={animated}
              center={center}
              circumference={circumference}
              color={ring.color}
              progress={progress}
              radius={radius}
              strokeWidth={ringStrokeWidth}
            />
          </Fragment>
        );
      })}
    </Svg>
  );
}

function ProgressCircle({
  animated,
  center,
  circumference,
  color,
  progress,
  radius,
  strokeWidth,
}: {
  animated: boolean;
  center: number;
  circumference: number;
  color: string;
  progress: number;
  radius: number;
  strokeWidth: number;
}) {
  const animatedProgress = useSharedValue(animated ? 0 : progress);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 700 });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={circumference * (1 - progress)}
      animatedProps={animatedProps}
    />
  );
}
