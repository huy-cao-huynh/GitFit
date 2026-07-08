import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Polygon,
  Polyline,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';
import type { ProgressPoint } from '@/lib/store/types';

interface LineChartProps {
  points: ProgressPoint[];
  width: number;
  height?: number;
  color: string;
  showArea?: boolean;
  yFormatter?: (value: number) => string;
}

const PADDING = { top: 10, right: 10, bottom: 20, left: 40 };
const MAX_DOTS = 16;

function niceStep(rough: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const step = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1;
  return step * power;
}

/** 3–4 round-numbered ticks spanning the data. */
function buildTicks(min: number, max: number): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step = niceStep((max - min) / 3);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick <= max + step / 2; tick += step) ticks.push(tick);
  return ticks;
}

function defaultFormat(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

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
  yFormatter = defaultFormat,
}: LineChartProps) {
  if (points.length === 0 || width <= PADDING.left + PADDING.right) return null;

  const values = points.map((p) => p.value);
  const ticks = buildTicks(Math.min(...values), Math.max(...values));
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const x = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) =>
    PADDING.top + plotHeight - ((value - domainMin) / (domainMax - domainMin)) * plotHeight;

  const coords = points.map((point, index) => ({ cx: x(index), cy: y(point.value) }));
  const polylinePoints = coords.map((c) => `${c.cx},${c.cy}`).join(' ');
  const baselineY = PADDING.top + plotHeight;
  const areaPoints = `${PADDING.left},${baselineY} ${polylinePoints} ${coords[coords.length - 1].cx},${baselineY}`;
  const gradientId = `area-${color.replace('#', '')}`;
  const dots = points.length <= MAX_DOTS ? coords : [coords[coords.length - 1]];

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
          fontSize={11}
          fontFamily={Fonts.medium}
          fill={Colors.textSecondary}
          textAnchor="end">
          {yFormatter(tick)}
        </SvgText>
      ))}

      {showArea && <Polygon points={areaPoints} fill={`url(#${gradientId})`} />}
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dots.map((dot, index) => (
        <Circle key={index} cx={dot.cx} cy={dot.cy} r={6} fill={Colors.background} />
      ))}
      {dots.map((dot, index) => (
        <Circle key={`dot-${index}`} cx={dot.cx} cy={dot.cy} r={4} fill={color} />
      ))}

      <SvgText
        x={PADDING.left}
        y={height - 4}
        fontSize={11}
        fontFamily={Fonts.medium}
        fill={Colors.textSecondary}
        textAnchor="start">
        {formatDate(points[0].date)}
      </SvgText>
      {points.length > 1 && (
        <SvgText
          x={width - PADDING.right}
          y={height - 4}
          fontSize={11}
          fontFamily={Fonts.medium}
          fill={Colors.textSecondary}
          textAnchor="end">
          {formatDate(points[points.length - 1].date)}
        </SvgText>
      )}
    </Svg>
  );
}
