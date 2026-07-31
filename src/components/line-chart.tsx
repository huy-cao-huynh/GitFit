import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Polygon,
  Polyline,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';
import { smoothLinePath } from '@/lib/chart-path';
import { buildTicks, defaultTickFormat } from '@/lib/chart-ticks';
import type { ProgressPoint } from '@/lib/store/types';

interface LineChartProps {
  points: ProgressPoint[];
  width: number;
  height?: number;
  color: string;
  showArea?: boolean;
  yFormatter?: (value: number) => string;
  /** Compact mode: no gridlines, labels, or dots — just the line + area. */
  sparkline?: boolean;
  /** Render the line as a Catmull-Rom smoothed curve instead of straight segments. */
  smooth?: boolean;
}

const PADDING = { top: 10, right: 10, bottom: 20, left: 40 };
const SPARK_PADDING = { top: 4, right: 4, bottom: 4, left: 4 };
const MAX_DOTS = 16;

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Single-series line chart with gridlines and y labels — no legend needed. */
export function LineChart({
  points,
  width,
  height = 160,
  color,
  showArea = true,
  yFormatter = defaultTickFormat,
  sparkline = false,
  smooth = false,
}: LineChartProps) {
  const padding = sparkline ? SPARK_PADDING : PADDING;
  if (points.length === 0 || width <= padding.left + padding.right) return null;

  const values = points.map((p) => p.value);
  const ticks = buildTicks(Math.min(...values), Math.max(...values));
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) =>
    padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) =>
    padding.top + plotHeight - ((value - domainMin) / (domainMax - domainMin)) * plotHeight;

  const coords = points.map((point, index) => ({ cx: x(index), cy: y(point.value) }));
  const polylinePoints = coords.map((c) => `${c.cx},${c.cy}`).join(' ');
  const baselineY = padding.top + plotHeight;
  const areaPoints = `${padding.left},${baselineY} ${polylinePoints} ${coords[coords.length - 1].cx},${baselineY}`;
  const gradientId = `area-${color.replace('#', '')}`;
  const dots = points.length <= MAX_DOTS ? coords : [coords[coords.length - 1]];
  const linePath = smooth && coords.length > 1 ? smoothLinePath(coords) : null;
  const areaPath = linePath
    ? `${linePath} L ${coords[coords.length - 1].cx},${baselineY} L ${padding.left},${baselineY} Z`
    : null;

  if (sparkline) {
    return (
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {showArea &&
          (areaPath ? (
            <Path d={areaPath} fill={`url(#${gradientId})`} />
          ) : (
            <Polygon points={areaPoints} fill={`url(#${gradientId})`} />
          ))}
        {linePath ? (
          <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <Circle
          cx={coords[coords.length - 1].cx}
          cy={coords[coords.length - 1].cy}
          r={3.5}
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.12} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {ticks.map((tick) => (
        <Line
          key={tick}
          x1={PADDING.left}
          y1={y(tick)}
          x2={width - PADDING.right}
          y2={y(tick)}
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}
      {ticks.map((tick) => (
        <SvgText
          key={`label-${tick}`}
          x={PADDING.left - 8}
          y={y(tick) + 4}
          fontSize={12}
          fontFamily={Fonts.display}
          fill={Colors.textSecondary}
          textAnchor="end">
          {yFormatter(tick)}
        </SvgText>
      ))}

      {showArea &&
        (areaPath ? (
          <Path d={areaPath} fill={`url(#${gradientId})`} />
        ) : (
          <Polygon points={areaPoints} fill={`url(#${gradientId})`} />
        ))}
      {linePath ? (
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {dots.map((dot, index) => (
        <Circle key={index} cx={dot.cx} cy={dot.cy} r={6} fill={Colors.surface} />
      ))}
      {dots.map((dot, index) => (
        <Circle key={`dot-${index}`} cx={dot.cx} cy={dot.cy} r={4} fill={color} />
      ))}

      <SvgText
        x={PADDING.left}
        y={height - 4}
        fontSize={12}
        fontFamily={Fonts.display}
        fill={Colors.textSecondary}
        textAnchor="start">
        {formatDate(points[0].date)}
      </SvgText>
      {points.length > 1 && (
        <SvgText
          x={width - PADDING.right}
          y={height - 4}
          fontSize={12}
          fontFamily={Fonts.display}
          fill={Colors.textSecondary}
          textAnchor="end">
          {formatDate(points[points.length - 1].date)}
        </SvgText>
      )}
    </Svg>
  );
}
