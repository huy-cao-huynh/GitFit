import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { LOGO_BAR, LOGO_NODES, LOGO_RING_STROKE, LOGO_VIEWBOX } from '@/constants/brand';
import { Colors } from '@/constants/theme';

/**
 * The commit-graph dumbbell mark (geometry in constants/brand.ts). Flat by
 * default; `gradient` paints the filled shapes primary → primaryLight. The
 * accent node strokes against whatever the rest of the mark is painted in —
 * lime on a neutral mark, near-white on a lime one — so it never disappears.
 */
export function GitFitLogo({
  size = 64,
  color = Colors.text,
  gradient = false,
}: {
  size?: number;
  color?: string;
  gradient?: boolean;
}) {
  const gradientId = useId();
  const paint = gradient ? `url(#${gradientId})` : color;
  const accent = gradient ? Colors.text : Colors.primary;

  return (
    <Svg width={size} height={size} viewBox={LOGO_VIEWBOX}>
      {gradient ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={Colors.primary} />
            <Stop offset="1" stopColor={Colors.primaryLight} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Rect
        x={LOGO_BAR.x}
        y={LOGO_BAR.y}
        width={LOGO_BAR.width}
        height={LOGO_BAR.height}
        rx={LOGO_BAR.rx}
        fill={paint}
      />
      {LOGO_NODES.map((node, index) =>
        node.filled ? (
          <Circle key={index} cx={node.cx} cy={node.cy} r={node.r} fill={paint} />
        ) : (
          <Circle
            key={index}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="none"
            stroke={node.accent ? accent : paint}
            strokeWidth={LOGO_RING_STROKE}
          />
        ),
      )}
    </Svg>
  );
}
