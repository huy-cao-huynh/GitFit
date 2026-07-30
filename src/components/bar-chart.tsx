import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';

export interface BarChartBar {
  label: string;
  value: number;
  /** The "current" bucket (today / this month) — rendered at full opacity, rest are muted. */
  highlighted?: boolean;
}

interface BarChartProps {
  bars: BarChartBar[];
  width: number;
  height?: number;
  color: string;
}

const PADDING = { top: 10, right: 2, bottom: 18, left: 2 };
const BAR_GAP = 4;
const BAR_RADIUS = 3;

/** Apple-Health-style vertical bar chart — one highlighted bar (today/current period), rest muted. */
export function BarChart({ bars, width, height = 140, color }: BarChartProps) {
  if (bars.length === 0 || width <= PADDING.left + PADDING.right) return null;

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(...bars.map((bar) => bar.value), 0);
  const domainMax = maxValue > 0 ? maxValue * 1.15 : 1;
  const barWidth = Math.max(2, (plotWidth - BAR_GAP * (bars.length - 1)) / bars.length);
  const radius = Math.min(BAR_RADIUS, barWidth / 2);
  const anyHighlighted = bars.some((bar) => bar.highlighted);

  return (
    <Svg width={width} height={height}>
      {bars.map((bar, index) => {
        const barHeight = Math.max(2, (bar.value / domainMax) * plotHeight);
        const x = PADDING.left + index * (barWidth + BAR_GAP);
        const y = PADDING.top + plotHeight - barHeight;
        return (
          <Rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={radius}
            ry={radius}
            fill={color}
            opacity={!anyHighlighted || bar.highlighted ? 1 : 0.35}
          />
        );
      })}
      {bars.map(
        (bar, index) =>
          bar.label && (
            <SvgText
              key={`label-${index}`}
              x={PADDING.left + index * (barWidth + BAR_GAP) + barWidth / 2}
              y={height - 4}
              fontSize={11}
              fontFamily={Fonts.medium}
              fill={Colors.textSecondary}
              textAnchor="middle">
              {bar.label}
            </SvgText>
          ),
      )}
    </Svg>
  );
}
