import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';
import { buildTicks, defaultTickFormat } from '@/lib/chart-ticks';

export interface BarChartBar {
  label: string;
  value: number;
}

interface BarChartProps {
  bars: BarChartBar[];
  width: number;
  height?: number;
  color: string;
  yFormatter?: (value: number) => string;
  /** Formats the callout above a selected bar; defaults to `yFormatter`. */
  calloutFormatter?: (value: number) => string;
  selectedIndex?: number | null;
  onSelectBar?: (index: number) => void;
}

const PADDING = { top: 26, right: 2, bottom: 18, left: 34 };
const BAR_GAP = 4;
const BAR_RADIUS = 3;

/** Apple-Health-style vertical bar chart — every bar stays the same color; tapping one draws a line up to a callout bubble showing its value. */
export function BarChart({
  bars,
  width,
  height = 140,
  color,
  yFormatter = defaultTickFormat,
  calloutFormatter,
  selectedIndex = null,
  onSelectBar,
}: BarChartProps) {
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
  const formatCallout = calloutFormatter ?? yFormatter;
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
        return <Rect key={index} x={x} y={y} width={barWidth} height={barHeight} rx={radius} ry={radius} fill={color} />;
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
      {selectedIndex !== null &&
        bars[selectedIndex] &&
        (() => {
          const bar = bars[selectedIndex];
          const barHeight = Math.max(2, (bar.value / domainMax) * plotHeight);
          const barTopY = PADDING.top + plotHeight - barHeight;
          const centerX = PADDING.left + selectedIndex * (barWidth + BAR_GAP) + barWidth / 2;
          const text = formatCallout(bar.value);
          const bubbleWidth = Math.max(36, text.length * 7 + 16);
          const bubbleHeight = 20;
          const bubbleY = 2;
          const bubbleX = clampBubbleX(centerX, bubbleWidth, width);
          const lineTopY = bubbleY + bubbleHeight + 4;
          return (
            <>
              <Line x1={centerX} y1={lineTopY} x2={centerX} y2={barTopY} stroke={Colors.textSecondary} strokeWidth={1} />
              <Rect x={bubbleX} y={bubbleY} width={bubbleWidth} height={bubbleHeight} rx={bubbleHeight / 2} ry={bubbleHeight / 2} fill={color} />
              <SvgText
                x={bubbleX + bubbleWidth / 2}
                y={bubbleY + bubbleHeight / 2 + 4}
                fontSize={11}
                fontFamily={Fonts.displayBold}
                fill={Colors.onPrimary}
                textAnchor="middle">
                {text}
              </SvgText>
            </>
          );
        })()}
      {/* Invisible full-height touch targets — wider than the visible bar so thin/near-zero bars stay tappable. */}
      {onSelectBar &&
        bars.map((_, index) => (
          <Rect
            key={`hit-${index}`}
            x={PADDING.left + index * (barWidth + BAR_GAP)}
            y={PADDING.top}
            width={barWidth}
            height={plotHeight}
            fill="transparent"
            onPress={() => onSelectBar(index)}
          />
        ))}
    </Svg>
  );
}

/** Keeps the callout bubble from clipping past the chart's left/right edges. */
function clampBubbleX(centerX: number, bubbleWidth: number, chartWidth: number): number {
  const margin = 2;
  return Math.min(Math.max(centerX - bubbleWidth / 2, margin), chartWidth - bubbleWidth - margin);
}
