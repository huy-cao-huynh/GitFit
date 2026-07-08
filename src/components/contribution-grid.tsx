import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts, Palette, Spacing } from '@/constants/theme';
import { toDateKey } from '@/lib/store/derive';
import type { Session } from '@/lib/store/types';

const GAP = 3;
const LABEL_HEIGHT = 16;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GitHub-style year-to-date grid; cell intensity scales with session duration. */
export function ContributionGrid({ sessions, width }: { sessions: Session[]; width: number }) {
  if (width <= 0) return null;

  const today = new Date();
  const jan1 = new Date(today.getFullYear(), 0, 1);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay()); // align back to Sunday

  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const weekCount = Math.floor(daysSinceStart / 7) + 1;
  const cellSize = Math.max(4, Math.floor((width - (weekCount - 1) * GAP) / weekCount));
  const height = LABEL_HEIGHT + 7 * cellSize + 6 * GAP;

  const minutesByDate = new Map<string, number>();
  for (const session of sessions) {
    minutesByDate.set(session.date, (minutesByDate.get(session.date) ?? 0) + session.durationMinutes);
  }

  const todayKey = toDateKey(today);
  const cells: { x: number; y: number; fill: string; opacity: number }[] = [];
  const monthLabels: { x: number; label: string }[] = [];
  let lastLabeledMonth = -1;

  for (let week = 0; week < weekCount; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      const key = toDateKey(date);
      if (date < jan1 || key > todayKey) continue;

      if (date.getDate() === 1 && date.getMonth() !== lastLabeledMonth) {
        lastLabeledMonth = date.getMonth();
        monthLabels.push({ x: week * (cellSize + GAP), label: MONTH_LABELS[date.getMonth()] });
      }

      const minutes = minutesByDate.get(key) ?? 0;
      cells.push({
        x: week * (cellSize + GAP),
        y: LABEL_HEIGHT + day * (cellSize + GAP),
        fill: minutes > 0 ? Palette.periwinkle : 'rgba(255,255,255,0.07)',
        opacity: minutes === 0 ? 1 : minutes < 30 ? 0.45 : minutes < 45 ? 0.75 : 1,
      });
    }
  }

  return (
    <Svg width={width} height={height}>
      {monthLabels.map((month) => (
        <SvgText
          key={month.label}
          x={month.x}
          y={11}
          fontSize={10}
          fontFamily={Fonts.medium}
          fill={Colors.textSecondary}>
          {month.label}
        </SvgText>
      ))}
      {cells.map((cell, index) => (
        <Rect
          key={index}
          x={cell.x}
          y={cell.y}
          width={cellSize}
          height={cellSize}
          rx={Spacing.half}
          fill={cell.fill}
          opacity={cell.opacity}
        />
      ))}
    </Svg>
  );
}
