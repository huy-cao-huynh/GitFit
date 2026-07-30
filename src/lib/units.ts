/**
 * Canonical storage is always imperial (lbs, miles, inches, oz) so no data
 * migration is ever needed — these helpers only convert at the display/input
 * boundary based on the user's Preferences.unitSystem.
 */

import type { CardioActivityType, UnitSystem } from '@/lib/store/types';

const LB_PER_KG = 2.20462;
const MI_PER_KM = 0.621371;
const OZ_PER_ML = 0.033814;
const IN_PER_CM = 0.393701;
const FT_PER_M = 3.28084;
const YD_PER_MILE = 1760;

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

/** Elevation reads in feet or metres — its own axis, not the cm/in body scale. */
export function elevationUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
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

/**
 * Pools are measured in yards regardless of the user's mi/km preference, so
 * swim distance ignores `UnitSystem` entirely.
 */
export function swimDistanceUnitLabel(): string {
  return 'yd';
}

export function toDisplaySwimDistance(miles: number): number {
  return Math.round(miles * YD_PER_MILE);
}

export function fromDisplaySwimDistance(yards: number): number {
  return yards / YD_PER_MILE;
}

/** Distance display keyed on activity type — swim is fixed to yards, everything else follows `UnitSystem`. */
export function distanceUnitLabelForActivity(activityType: CardioActivityType, system: UnitSystem): string {
  return activityType === 'swim' ? swimDistanceUnitLabel() : distanceUnitLabel(system);
}

export function toDisplayDistanceForActivity(miles: number, activityType: CardioActivityType, system: UnitSystem): number {
  return activityType === 'swim' ? toDisplaySwimDistance(miles) : toDisplayDistance(miles, system);
}

export function fromDisplayDistanceForActivity(value: number, activityType: CardioActivityType, system: UnitSystem): number {
  return activityType === 'swim' ? fromDisplaySwimDistance(value) : fromDisplayDistance(value, system);
}

/** Canonical seconds-per-mile pace → seconds-per-display-unit (mile or km). */
export function toDisplayPaceSecPerUnit(secPerMile: number, system: UnitSystem): number {
  return system === 'metric' ? secPerMile * MI_PER_KM : secPerMile;
}

export function formatPace(secPerMile: number, system: UnitSystem): string {
  const secPerUnit = toDisplayPaceSecPerUnit(secPerMile, system);
  const minutes = Math.floor(secPerUnit / 60);
  const seconds = Math.round(secPerUnit % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds} /${distanceUnitLabel(system)}`;
}

/** Canonical feet → display value in the active unit system, rounded whole. */
export function toDisplayElevation(feet: number, system: UnitSystem): number {
  return Math.round(system === 'metric' ? feet / FT_PER_M : feet);
}

export function formatElevation(feet: number, system: UnitSystem): string {
  return `${toDisplayElevation(feet, system)} ${elevationUnitLabel(system)}`;
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
