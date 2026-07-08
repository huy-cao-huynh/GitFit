export function clampToStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.max(min, Math.min(max, stepped)).toFixed(2));
}

export function formatStepperValue(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
