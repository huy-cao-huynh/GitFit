/**
 * Canonical storage is always imperial (lbs, miles, inches, oz) so no data
 * migration is ever needed — these helpers only convert at the display/input
 * boundary based on the user's Preferences.unitSystem.
 */

import type { UnitSystem } from '@/lib/store/types';

const LB_PER_KG = 2.20462;
const MI_PER_KM = 0.621371;
const OZ_PER_ML = 0.033814;
const IN_PER_CM = 0.393701;

export function weightUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'kg' : 'lbs';
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'km' : 'mi';
}

export function volumeUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'mL' : 'oz';
}

export function lengthUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'cm' : 'in';
}

/** Canonical lbs → display value in the active unit system. */
export function toDisplayWeight(lbs: number, system: UnitSystem): number {
  return system === 'metric' ? round(lbs / LB_PER_KG, 1) : round(lbs, 1);
}

/** Display value in the active unit system → canonical lbs. */
export function fromDisplayWeight(value: number, system: UnitSystem): number {
  return system === 'metric' ? value * LB_PER_KG : value;
}

/** Canonical miles → display value in the active unit system. */
export function toDisplayDistance(miles: number, system: UnitSystem): number {
  return system === 'metric' ? round(miles / MI_PER_KM, 2) : round(miles, 2);
}

export function fromDisplayDistance(value: number, system: UnitSystem): number {
  return system === 'metric' ? value * MI_PER_KM : value;
}

/** Canonical ounces → display value in the active unit system. */
export function toDisplayVolume(ounces: number, system: UnitSystem): number {
  return system === 'metric' ? Math.round(ounces / OZ_PER_ML) : Math.round(ounces);
}

export function fromDisplayVolume(value: number, system: UnitSystem): number {
  return system === 'metric' ? value * OZ_PER_ML : value;
}

/** Canonical inches → display value in the active unit system. */
export function toDisplayLength(inches: number, system: UnitSystem): number {
  return system === 'metric' ? round(inches / IN_PER_CM, 1) : round(inches, 1);
}

export function fromDisplayLength(value: number, system: UnitSystem): number {
  return system === 'metric' ? value * IN_PER_CM : value;
}

export function formatWeight(lbs: number, system: UnitSystem): string {
  return `${toDisplayWeight(lbs, system)} ${weightUnitLabel(system)}`;
}

export function formatDistance(miles: number, system: UnitSystem): string {
  return `${toDisplayDistance(miles, system)} ${distanceUnitLabel(system)}`;
}

export function formatVolume(ounces: number, system: UnitSystem): string {
  return `${toDisplayVolume(ounces, system)} ${volumeUnitLabel(system)}`;
}

/** Imperial renders as feet'inches", metric as whole centimeters. */
export function formatHeight(inches: number, system: UnitSystem): string {
  if (system === 'metric') return `${Math.round(inches / IN_PER_CM)} cm`;
  const feet = Math.floor(inches / 12);
  const remainder = Math.round(inches % 12);
  return `${feet}'${remainder}"`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
