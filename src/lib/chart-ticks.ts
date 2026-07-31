/** Shared axis-tick math for the hand-rolled SVG charts (line-chart.tsx, bar-chart.tsx). */

function niceStep(rough: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const step = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1;
  return step * power;
}

/** 3–4 round-numbered ticks spanning [min, max]. */
export function buildTicks(min: number, max: number): number[] {
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

export function defaultTickFormat(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}
