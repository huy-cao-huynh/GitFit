/** Reference weights (canonical lbs) for playful volume comparisons. */
const RHINO_LBS = 5000;
const BUS_LBS = 24000;
const WHALE_LBS = 300000;

/** Scales a total-lifted weight (canonical lbs) into a whimsical, readable unit. */
export function funWeightUnit(totalLbs: number): { value: number; unit: string } {
  if (totalLbs >= WHALE_LBS) {
    const value = totalLbs / WHALE_LBS;
    return { value, unit: value < 1.05 ? 'blue whale' : 'blue whales' };
  }
  if (totalLbs >= BUS_LBS) {
    const value = totalLbs / BUS_LBS;
    return { value, unit: value < 1.05 ? 'school bus' : 'school buses' };
  }
  const value = totalLbs / RHINO_LBS;
  return { value, unit: value < 1.05 ? 'rhino' : 'rhinos' };
}
