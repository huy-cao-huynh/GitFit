import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  cardioActivityTypeToStravaSportType,
  isImportableStravaActivity,
  stravaSportTypeToCardioActivityType,
} from './sport-type.ts';

Deno.test('isImportableStravaActivity accepts the MVP allow-list', () => {
  assertEquals(isImportableStravaActivity('Run'), true);
  assertEquals(isImportableStravaActivity('TrailRun'), true);
  assertEquals(isImportableStravaActivity('Walk'), true);
  assertEquals(isImportableStravaActivity('Hike'), true);
  assertEquals(isImportableStravaActivity('Ride'), true);
});

Deno.test('isImportableStravaActivity rejects swim and unknown sport types', () => {
  assertEquals(isImportableStravaActivity('Swim'), false);
  assertEquals(isImportableStravaActivity('Yoga'), false);
  assertEquals(isImportableStravaActivity('WeightTraining'), false);
});

Deno.test('stravaSportTypeToCardioActivityType maps known sport types', () => {
  assertEquals(stravaSportTypeToCardioActivityType('Run'), 'run');
  assertEquals(stravaSportTypeToCardioActivityType('TrailRun'), 'run');
  assertEquals(stravaSportTypeToCardioActivityType('GravelRide'), 'cycle');
});

Deno.test('stravaSportTypeToCardioActivityType falls back to the legacy type field', () => {
  assertEquals(stravaSportTypeToCardioActivityType('', 'Hike'), 'hike');
});

Deno.test('stravaSportTypeToCardioActivityType falls back to other for unknown types', () => {
  assertEquals(stravaSportTypeToCardioActivityType('Yoga'), 'other');
});

Deno.test('cardioActivityTypeToStravaSportType round-trips the import allow-list', () => {
  assertEquals(cardioActivityTypeToStravaSportType('run'), 'Run');
  assertEquals(cardioActivityTypeToStravaSportType('walk'), 'Walk');
  assertEquals(cardioActivityTypeToStravaSportType('hike'), 'Hike');
  assertEquals(cardioActivityTypeToStravaSportType('cycle'), 'Ride');
});
