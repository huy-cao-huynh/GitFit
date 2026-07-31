import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';
import { buildTicks, defaultTickFormat } from '@/lib/chart-ticks';

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
  yFormatter?: (value: number) => string;
}

const PADDING = { top: 10, right: 2, bottom: 18, left: 34 };
const BAR_GAP = 4;
const BAR_RADIUS = 3;

/** Apple-Health-style vertical bar chart — one highlighted bar (today/current period), rest muted, with a y-axis so the bar heights are actually readable. */
export function BarChart({ bars, width, height = 140, color, yFormatter = defaultTickFormat }: BarChartProps) {
  if (bars.length === 0 || width <= PADDING.left + PADDING.right) return null;

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(...bars.map((bar) => bar.value), 0);
  // Ticks span the real data range; the chart itself renders with extra
  // headroom (domainMax) so the tallest bar doesn't touch the top edge.
  const ticks = buildTicks(0, maxValue > 0 ? maxValue : 1);
  const domainMax = Math.max(maxValue * 1.15, ticks[ticks.length - 1]);
  const barWidth = Math.max(2, (plotWidth - BAR_GAP * (bars.length - 1)) / bars.length);
  const radius = Math.min(BAR_RADIUS, barWidth / 2);
  const anyHighlighted = bars.some((bar) => bar.highlighted);
  const yFor = (value: number) => PADDING.top + plotHeight - (value / domainMax) * plotHeight;

  return (
    <Svg width={width} height={height}>
      {ticks.map((tick) => (
        <Line
          key={tick}
          x1={PADDING.left}
          y1={yFor(tick)}
          x2={width - PADDING.right}
          y2={yFor(tick)}
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}
      {ticks.map((tick) => (
        <SvgText
          key={`label-${tick}`}
          x={PADDING.left - 8}
          y={yFor(tick) + 4}
          fontSize={11}
          fontFamily={Fonts.display}
          fill={Colors.textSecondary}
          textAnchor="end">
          {yFormatter(tick)}
        </SvgText>
      ))}
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
              key={`bar-label-${index}`}
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
