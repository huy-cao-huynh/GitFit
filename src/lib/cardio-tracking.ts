import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useState } from 'react';

import {
  elapsedOf,
  haversineMiles,
  smoothedElevationGainFt,
  totalDistanceMiles,
} from '@/lib/cardio-math';
import type { GpsPoint } from '@/lib/store/types';

/**
 * GPS tracking for a cardio session.
 *
 * Recording lives in module scope, not in React state, for two reasons. First,
 * background fixes arrive through a TaskManager callback that runs outside the
 * component tree, so there is nowhere else for them to land. Second, the
 * session has to survive the screen unmounting and the app being backgrounded
 * — the phone goes in a pocket for the whole run, which is exactly when a
 * foreground-only, state-held recorder would stop.
 *
 * `defineTask` must run before iOS delivers anything, including after a cold
 * start, so the root layout imports this module for its side effect.
 */
export const CARDIO_LOCATION_TASK = 'gitfit-cardio-location';

const STORAGE_KEY = 'gitfit.cardio.active-session';
const ACCURACY = Location.Accuracy.BestForNavigation;
const TIME_INTERVAL_MS = 2000;
const DISTANCE_INTERVAL_M = 5;
const POLL_INTERVAL_MS = 1000;
/** Fixes vaguer than this are noise — keeping them makes distance creep upward while standing still. */
const MAX_ACCURACY_M = 35;
/**
 * A fix implying a faster speed than this from the last accepted point is a
 * GPS jitter/teleport artifact (e.g. a signal-reacquisition jump), not real
 * motion — accepting it corrupts both distance and pace off a single bad
 * sample. Generous enough to never reject genuine fast downhill cycling.
 */
const MAX_IMPLIED_SPEED_MPH = 55;
/** Trailing window behind the live "current pace" readout. */
const ROLLING_PACE_WINDOW_MS = 30_000;
/** Under this, a pace figure is a division by nearly nothing and reads as nonsense. */
const MIN_PACE_DISTANCE_MILES = 0.02;
const PERSIST_INTERVAL_MS = 10_000;

interface ActiveSession {
  routineId: string | null;
  startedAt: number;
  /** ms epoch the current pause began, or null while running. */
  pausedAt: number | null;
  /** Total ms spent paused, excluding the pause currently in progress. */
  pausedMs: number;
  points: GpsPoint[];
}

let session: ActiveSession | null = null;
let watch: Location.LocationSubscription | null = null;
let backgroundTaskRunning = false;
let lastPersistAt = 0;

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  CARDIO_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return;
    for (const location of data.locations) appendFix(location);
  },
);

function appendFix(location: Location.LocationObject) {
  if (!session || session.pausedAt !== null) return;
  const { accuracy } = location.coords;
  if (accuracy != null && accuracy > MAX_ACCURACY_M) return;

  const point: GpsPoint = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    altitude: location.coords.altitude ?? undefined,
    t: location.timestamp,
    e: movingMs(session, Date.now()),
  };

  const last = session.points[session.points.length - 1];
  if (last && isImplausibleJump(last, point)) return;

  session.points.push(point);
  persist();
}

function isImplausibleJump(last: GpsPoint, point: GpsPoint): boolean {
  const hours = (elapsedOf(point) - elapsedOf(last)) / 1000 / 3600;
  if (hours <= 0) return false;
  const impliedMph = haversineMiles(last, point) / hours;
  return impliedMph > MAX_IMPLIED_SPEED_MPH;
}

/**
 * Wall-clock ms since the session started, minus everything spent paused.
 * Recomputed from anchored timestamps on every read rather than accumulated,
 * so backgrounding and pausing can't drift it.
 */
function movingMs(active: ActiveSession, at: number): number {
  const frozenAt = active.pausedAt ?? at;
  return Math.max(0, frozenAt - active.startedAt - active.pausedMs);
}

/** Throttled mirror to disk, so a crash or force-quit mid-run doesn't lose the route. */
function persist(force = false) {
  if (!session) return;
  const now = Date.now();
  if (!force && now - lastPersistAt < PERSIST_INTERVAL_MS) return;
  lastPersistAt = now;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session)).catch(() => {});
}

async function stopLocationSources() {
  watch?.remove();
  watch = null;
  if (!backgroundTaskRunning) return;
  backgroundTaskRunning = false;
  try {
    if (await TaskManager.isTaskRegisteredAsync(CARDIO_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(CARDIO_LOCATION_TASK);
    }
  } catch {
    // Already torn down by the OS — nothing left to stop.
  }
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * How much of the route we can actually record. `background` keeps recording
 * with the phone locked; `foreground` stops the moment the screen sleeps;
 * `denied` means permission was refused; `off` means we never asked, because
 * the activity isn't one GPS says anything useful about.
 */
export type TrackingPermission = 'background' | 'foreground' | 'denied' | 'off';

export interface CardioTrackingResult {
  samples: GpsPoint[];
  distanceMiles: number;
  movingSeconds: number;
  /** `null` when there isn't enough altitude data to say anything, distinct from a real flat-route `0`. */
  elevationGainFt: number | null;
  avgPaceSecPerMile: number | null;
}

/**
 * Begins a session. With `trackLocation` false the clock, pause and stop all
 * work exactly the same — no permission is requested and no GPS hardware is
 * woken, so a pool swim doesn't cost a battery or leave the location indicator
 * burning for an hour.
 */
export async function startCardioTracking(
  routineId: string | null,
  trackLocation = true,
): Promise<TrackingPermission> {
  await stopLocationSources();
  session = { routineId, startedAt: Date.now(), pausedAt: null, pausedMs: 0, points: [] };
  persist(true);

  if (!trackLocation) return 'off';

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return 'denied';

  // Background is a genuine upgrade, not a requirement: if it's refused we
  // still record while the screen is on rather than failing the whole session.
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status === 'granted') {
      await Location.startLocationUpdatesAsync(CARDIO_LOCATION_TASK, {
        accuracy: ACCURACY,
        timeInterval: TIME_INTERVAL_MS,
        distanceInterval: DISTANCE_INTERVAL_M,
        activityType: Location.LocationActivityType.Fitness,
        // We own pausing — iOS auto-pause would silently stop the route while
        // the app still believes it's recording.
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
      backgroundTaskRunning = true;
      return 'background';
    }
  } catch (error) {
    console.warn('background location unavailable, falling back to foreground', error);
  }

  watch = await Location.watchPositionAsync(
    { accuracy: ACCURACY, timeInterval: TIME_INTERVAL_MS, distanceInterval: DISTANCE_INTERVAL_M },
    appendFix,
  );
  return 'foreground';
}

/**
 * Location updates keep flowing while paused — `appendFix` drops them. Tearing
 * the subscription down and rebuilding it would cost several seconds to
 * reacquire a fix on resume, which is worse than the battery it saves.
 */
export function pauseCardioTracking() {
  if (!session || session.pausedAt !== null) return;
  session.pausedAt = Date.now();
  persist(true);
}

export function resumeCardioTracking() {
  if (!session || session.pausedAt === null) return;
  session.pausedMs += Date.now() - session.pausedAt;
  session.pausedAt = null;
  persist(true);
}

/** Ends recording and hands back the finished route. */
export async function stopCardioTracking(): Promise<CardioTrackingResult> {
  const result = summarize(session);
  await stopLocationSources();
  session = null;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  return result;
}

// ---------------------------------------------------------------------------
// Crash recovery
// ---------------------------------------------------------------------------

export interface InterruptedCardioSession {
  routineId: string | null;
  startedAt: number;
  result: CardioTrackingResult;
}

/**
 * A session left on disk by an app that died mid-run. Duration is measured to
 * the last recorded fix, not to now, so a run interrupted an hour ago doesn't
 * come back an hour long.
 */
export async function loadInterruptedCardioSession(): Promise<InterruptedCardioSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as ActiveSession;
    if (!stored?.points?.length) return null;
    const lastFixAt = stored.points[stored.points.length - 1].t;
    return {
      routineId: stored.routineId,
      startedAt: stored.startedAt,
      result: summarize(stored, Math.max(stored.startedAt, lastFixAt)),
    };
  } catch {
    return null;
  }
}

export async function clearInterruptedCardioSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface CardioTrackingState extends CardioTrackingResult {
  /** Pace over the last ~30 s, which is what you actually steer by mid-run. */
  currentPaceSecPerMile: number | null;
  isPaused: boolean;
  permission: TrackingPermission | null;
}

const IDLE_STATE: CardioTrackingState = {
  samples: [],
  distanceMiles: 0,
  movingSeconds: 0,
  elevationGainFt: null,
  avgPaceSecPerMile: null,
  currentPaceSecPerMile: null,
  isPaused: false,
  permission: null,
};

/**
 * Reads the module-scope recorder once a second. Polling rather than
 * subscribing keeps the background task free of React entanglement, and fixes
 * only arrive every 1-2 s anyway.
 */
export function useCardioTracking() {
  const [state, setState] = useState<CardioTrackingState>(IDLE_STATE);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!isTracking) return;
    const interval = setInterval(() => {
      setState((previous) => ({ ...readLiveState(), permission: previous.permission }));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isTracking]);

  const start = useCallback(async (routineId: string | null, trackLocation = true) => {
    const permission = await startCardioTracking(routineId, trackLocation);
    setIsTracking(true);
    setState({ ...readLiveState(), permission });
    return permission;
  }, []);

  // Pause and resume refresh immediately instead of waiting out the poll, so
  // the clock visibly stops the instant the button is pressed.
  const pause = useCallback(() => {
    pauseCardioTracking();
    setState((previous) => ({ ...readLiveState(), permission: previous.permission }));
  }, []);

  const resume = useCallback(() => {
    resumeCardioTracking();
    setState((previous) => ({ ...readLiveState(), permission: previous.permission }));
  }, []);

  const stop = useCallback(async () => {
    const result = await stopCardioTracking();
    setIsTracking(false);
    setState(IDLE_STATE);
    return result;
  }, []);

  return { ...state, start, pause, resume, stop };
}

function readLiveState(): Omit<CardioTrackingState, 'permission'> {
  const result = summarize(session);
  return {
    ...result,
    currentPaceSecPerMile: rollingPaceSecPerMile(result.samples),
    isPaused: session?.pausedAt != null,
  };
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

function summarize(active: ActiveSession | null, at = Date.now()): CardioTrackingResult {
  if (!active) return { samples: [], distanceMiles: 0, movingSeconds: 0, elevationGainFt: null, avgPaceSecPerMile: null };
  const samples = active.points.slice();
  const distanceMiles = totalDistanceMiles(samples);
  const movingSeconds = Math.floor(movingMs(active, at) / 1000);
  return {
    samples,
    distanceMiles,
    movingSeconds,
    elevationGainFt: smoothedElevationGainFt(samples),
    avgPaceSecPerMile: distanceMiles >= MIN_PACE_DISTANCE_MILES ? movingSeconds / distanceMiles : null,
  };
}

function rollingPaceSecPerMile(points: GpsPoint[]): number | null {
  if (points.length < 2) return null;
  const endMs = elapsedOf(points[points.length - 1]);
  let distance = 0;
  let startIndex = points.length - 1;
  for (let i = points.length - 1; i > 0; i--) {
    distance += haversineMiles(points[i - 1], points[i]);
    startIndex = i - 1;
    if (endMs - elapsedOf(points[i - 1]) >= ROLLING_PACE_WINDOW_MS) break;
  }
  const seconds = (endMs - elapsedOf(points[startIndex])) / 1000;
  if (seconds <= 0 || distance < MIN_PACE_DISTANCE_MILES) return null;
  return seconds / distance;
}
