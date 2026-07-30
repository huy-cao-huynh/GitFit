/** Catmull-Rom (tension 1/6) to cubic-bezier SVG path through every coordinate. */
export function smoothLinePath(coords: { cx: number; cy: number }[]): string {
  let d = `M ${coords[0].cx},${coords[0].cy}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.cx + (p2.cx - p0.cx) / 6;
    const cp1y = p1.cy + (p2.cy - p0.cy) / 6;
    const cp2x = p2.cx - (p3.cx - p1.cx) / 6;
    const cp2y = p2.cy - (p3.cy - p1.cy) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.cx},${p2.cy}`;
  }
  return d;
}
