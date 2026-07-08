import { Fragment } from 'react';
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
}

/** Concentric progress rings, outermost ring first. */
export function ActivityRings({ rings, size = 128, strokeWidth = 11, gap = 5 }: ActivityRingsProps) {
  const viewBoxSize = 160;
  const center = viewBoxSize / 2;
  const outerRadius = center - strokeWidth / 2 - 6;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ transform: [{ rotate: '-90deg' }] }}>
      {rings.map((ring, index) => {
        const radius = outerRadius - index * (strokeWidth + gap);
        const circumference = 2 * Math.PI * radius;
        const progress = Math.min(Math.max(ring.progress, 0), 1);

        return (
          <Fragment key={index}>
            <Circle cx={center} cy={center} r={radius} fill="none" stroke={ring.trackColor} strokeWidth={strokeWidth} />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </Fragment>
        );
      })}
    </Svg>
  );
}
