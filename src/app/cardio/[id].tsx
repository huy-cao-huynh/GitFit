import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardioSummary } from '@/components/cardio-summary';
import { ElevationProfile } from '@/components/elevation-profile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimerText } from '@/components/timer-text';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ACTIVITY_ICONS, ACTIVITY_LABELS } from '@/lib/activity-icons';
import {
  clearInterruptedCardioSession,
  loadInterruptedCardioSession,
  useCardioTracking,
  type CardioTrackingResult,
  type InterruptedCardioSession,
} from '@/lib/cardio-tracking';
import { haptics } from '@/lib/haptics';
import { estimateCardioCaloriesDetailed, latestBodyweightLb, todayKey, tracksLocation } from '@/lib/store/derive';
import { makeId } from '@/lib/store/id';
import type { CardioActivityType, CardioSession, UnitSystem } from '@/lib/store/types';
import {
  distanceUnitLabel,
  distanceUnitLabelForActivity,
  elevationUnitLabel,
  formatPace,
  fromDisplayDistanceForActivity,
  toDisplayDistance,
  toDisplayElevation,
} from '@/lib/units';
import { useStore } from '@/providers/store-provider';

const colors = Colors;

type Phase = 'idle' | 'active' | 'enteringDistance' | 'finished';

/** Everything this screen needs, whether it's a saved routine or an ad-hoc pick with nothing persisted. */
interface CardioSessionRoutine {
  id: string | null;
  name: string;
  activityType: CardioActivityType;
}

export default function CardioSessionScreen() {
  const { id, activityType: activityTypeParam } = useLocalSearchParams<{ id: string; activityType?: CardioActivityType }>();
  const { routines, bodyweight, addCardioSession, preferences } = useStore();
  const unitSystem = preferences.unitSystem;
  const matchedRoutine = routines.find((r) => r.id === id && r.category === 'cardio');
  // No saved routine for this id: fall back to an unpersisted ad-hoc session
  // built from just the activity type picked in the "New Cardio" flow. Memoized
  // so its identity stays stable across renders — otherwise a fresh object
  // every render would retrigger the interrupted-session effect below.
  const routine: CardioSessionRoutine | undefined = useMemo(() => {
    if (matchedRoutine) {
      return { id: matchedRoutine.id, name: matchedRoutine.name, activityType: matchedRoutine.activityType ?? 'other' };
    }
    if (activityTypeParam) {
      return { id: null, name: ACTIVITY_LABELS[activityTypeParam], activityType: activityTypeParam };
    }
    return undefined;
  }, [matchedRoutine, activityTypeParam]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [distanceDisplay, setDistanceDisplay] = useState('');
  const [finishedSession, setFinishedSession] = useState<CardioSession | null>(null);
  /** The recorded route, handed over by `stop()` and held until it's saved. */
  const [result, setResult] = useState<CardioTrackingResult | null>(null);
  const [interrupted, setInterrupted] = useState<InterruptedCardioSession | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const tracking = useCardioTracking();

  // A session left behind by an app that died mid-run. Surfaced as a card on
  // the idle screen rather than an alert, so it can't be dismissed by accident.
  useEffect(() => {
    if (!routine) return;
    let cancelled = false;
    (async () => {
      const found = await loadInterruptedCardioSession();
      if (cancelled || !found || found.routineId !== routine.id) return;
      if (found.result.samples.length < 2) {
        await clearInterruptedCardioSession();
        return;
      }
      setInterrupted(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [routine]);

  if (!routine) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Workout not found</ThemedText>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <ThemedText style={styles.primaryButtonText}>Back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const activityType = routine.activityType;
  // Swimming and the 'other' catch-all get a stopwatch, not a route: GPS would
  // trace a pool wall or an indoor machine and then skip the manual distance
  // entry those activities actually depend on.
  const gpsTracked = tracksLocation(activityType);

  const buildSession = (tracked: CardioTrackingResult, distanceMiles: number | undefined): CardioSession => {
    const minutes = Math.max(1, Math.round(tracked.movingSeconds / 60));
    return {
      id: makeId(),
      routineId: routine.id,
      name: routine.name,
      activityType,
      date: todayKey(),
      minutes,
      distanceMiles,
      calories: estimateCardioCaloriesDetailed({
        activityType,
        minutes,
        distanceMiles,
        elevationGainFt: tracked.elevationGainFt ?? undefined,
        bodyweightLb: latestBodyweightLb(bodyweight),
      }),
      route: tracked.samples.length > 1 ? tracked.samples : undefined,
      elevationGainFt: tracked.elevationGainFt ?? undefined,
      avgPaceSecPerMile:
        distanceMiles && distanceMiles > 0 ? tracked.movingSeconds / distanceMiles : undefined,
    };
  };

  const commit = (session: CardioSession) => {
    addCardioSession(session);
    setFinishedSession(session);
    setPhase('finished');
  };

  const start = async () => {
    haptics.impact();
    setInterrupted(null);
    await clearInterruptedCardioSession();
    const permission = await tracking.start(routine.id, gpsTracked);
    setPhase('active');
    if (permission === 'denied') {
      Alert.alert(
        'Location is off',
        'GitFit can still time this workout, but it won’t record a route or distance. You can enter the distance yourself at the end.',
      );
    }
  };

  const togglePause = () => {
    haptics.impact();
    if (tracking.isPaused) tracking.resume();
    else tracking.pause();
  };

  const finish = async () => {
    const tracked = await tracking.stop();
    setResult(tracked);
    // GPS already answered the distance question — don't ask it again. The
    // manual step survives only for sessions with nothing recorded (permission
    // refused, no fix, treadmill).
    if (tracked.samples.length > 1) {
      commit(buildSession(tracked, tracked.distanceMiles));
      return;
    }
    setDistanceDisplay('');
    setPhase('enteringDistance');
  };

  const requestEnd = () => {
    Alert.alert('End workout?', 'Save what you’ve done, or discard the whole session.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Save & finish', onPress: finish },
      {
        text: 'Discard workout',
        style: 'destructive',
        onPress: async () => {
          await tracking.stop();
          router.dismissTo('/dashboard');
        },
      },
    ]);
  };

  const saveManualDistance = () => {
    const tracked = result ?? { samples: [], distanceMiles: 0, movingSeconds: 0, elevationGainFt: null, avgPaceSecPerMile: null };
    const raw = distanceDisplay.trim()
      ? fromDisplayDistanceForActivity(Number(distanceDisplay), activityType, unitSystem)
      : undefined;
    const distanceMiles = raw !== undefined && Number.isFinite(raw) && raw > 0 ? raw : undefined;
    commit(buildSession(tracked, distanceMiles));
  };

  const recoverInterrupted = () => {
    if (!interrupted) return;
    clearInterruptedCardioSession();
    setInterrupted(null);
    commit(buildSession(interrupted.result, interrupted.result.distanceMiles));
  };

  const discardInterrupted = () => {
    clearInterruptedCardioSession();
    setInterrupted(null);
  };

  if (phase === 'finished') {
    const session = finishedSession!;
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.finishedContent} showsVerticalScrollIndicator={false}>
            <View style={styles.finishedHeader}>
              <ThemedText type="title">Nice work.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {routine.name}
              </ThemedText>
            </View>

            <CardioSummary animated session={session} unitSystem={unitSystem} />
          </ScrollView>

          <Pressable style={styles.primaryButton} onPress={() => router.dismissTo('/dashboard')}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Return to Home
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'enteringDistance') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.exerciseHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {routine.name}
            </ThemedText>
            <ThemedText type="subtitle">How far did you go?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {gpsTracked
                ? 'No route was recorded, so this one’s on you. Leave it blank to log time only.'
                : 'Leave it blank to log time only.'}
            </ThemedText>
          </View>

          <ThemedView type="surface" style={styles.distanceCard}>
            <TextInput
              style={styles.distanceInput}
              placeholder={`Distance (${distanceUnitLabelForActivity(activityType, unitSystem)}, optional)`}
              placeholderTextColor={colors.textMuted}
              value={distanceDisplay}
              onChangeText={setDistanceDisplay}
              keyboardType="decimal-pad"
            />
          </ThemedView>

          <Pressable style={styles.primaryButton} onPress={saveManualDistance}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              Save Workout
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'active') {
    const paused = tracking.isPaused;
    const pace = tracking.currentPaceSecPerMile;

    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topRow}>
            <SymbolView
              name={ACTIVITY_ICONS[routine.activityType]}
              size={16}
              tintColor={colors.primaryLight}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {routine.name}
            </ThemedText>
          </View>

          <View style={[styles.liveBody, paused && styles.dimmed]}>
            <View style={styles.timerArea}>
              <ThemedText type="label" themeColor={paused ? 'primary' : 'textSecondary'}>
                {paused ? 'PAUSED' : 'ELAPSED'}
              </ThemedText>
              {/* DSEG7 belongs to clocks that are still running — this and the
                  live distance below are the only two on the screen. */}
              <TimerText seconds={tracking.movingSeconds} />
            </View>

            {/* Distance, pace and elevation only exist if something is being
                traced — a swim shows the clock alone rather than three dashes. */}
            {gpsTracked ? (
              <>
                <View style={styles.liveStatsRow}>
                  <View style={styles.liveStatColumn}>
                    <LiveDistanceText miles={tracking.distanceMiles} unitSystem={unitSystem} />
                    <ThemedText type="label" themeColor="textSecondary">
                      {distanceUnitLabel(unitSystem).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.liveStatColumn}>
                    <ThemedText type="statLarge">
                      {pace ? formatPace(pace, unitSystem).split(' ')[0] : '—:—'}
                    </ThemedText>
                    <ThemedText type="label" themeColor="textSecondary">
                      PACE
                    </ThemedText>
                  </View>
                </View>

                {/* Average trails current pace: rolling pace is what you steer
                    by, the average is what you're settling into. */}
                <ThemedText type="small" themeColor="textSecondary" style={styles.captionRow}>
                  {tracking.avgPaceSecPerMile ? (
                    <>
                      avg{' '}
                      <ThemedText type="statInline">{formatPace(tracking.avgPaceSecPerMile, unitSystem)}</ThemedText>
                    </>
                  ) : (
                    'finding your pace…'
                  )}
                  {tracking.elevationGainFt != null && tracking.elevationGainFt >= 1 ? (
                    <>
                      {'   ·   climb '}
                      <ThemedText type="statInline">
                        {toDisplayElevation(tracking.elevationGainFt, unitSystem)} {elevationUnitLabel(unitSystem)}
                      </ThemedText>
                    </>
                  ) : null}
                </ThemedText>

                <View
                  style={styles.elevationSlot}
                  onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}>
                  {chartWidth > 0 ? (
                    <ElevationProfile
                      bare
                      route={tracking.samples}
                      width={chartWidth}
                      height={72}
                      unitSystem={unitSystem}
                    />
                  ) : null}
                </View>
              </>
            ) : null}
          </View>

          {tracking.permission === 'denied' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.captionRow}>
              Location is off — timing only. You can add the distance when you finish.
            </ThemedText>
          ) : null}
          {tracking.permission === 'foreground' ? (
            <Pressable onPress={() => Linking.openSettings()}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.captionRow}>
                Background location is off — keep the screen on or the route will stop recording.{' '}
                <ThemedText type="small" themeColor="primary">
                  Turn on in Settings
                </ThemedText>
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={togglePause}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              {paused ? 'Resume' : 'Pause'}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={requestEnd}>
            <ThemedText type="smallBold" themeColor="primary">
              End Workout
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <SymbolView name={ACTIVITY_ICONS[routine.activityType]} size={16} tintColor={colors.primaryLight} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {routine.name}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.overviewContent}>
          {interrupted ? (
            <ThemedView type="surface" style={styles.recoveryCard}>
              <ThemedText type="label" themeColor="primary">
                UNFINISHED WORKOUT
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                GitFit closed while a session was recording.{' '}
                <ThemedText type="statInline">
                  {toDisplayDistance(interrupted.result.distanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
                </ThemedText>{' '}
                over{' '}
                <ThemedText type="statInline">
                  {Math.max(1, Math.round(interrupted.result.movingSeconds / 60))} min
                </ThemedText>{' '}
                was tracked.
              </ThemedText>
              <View style={styles.recoveryActions}>
                <Pressable style={styles.recoverySave} onPress={recoverInterrupted}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Save it
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.recoveryDiscard} onPress={discardInterrupted} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Discard
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ) : null}

          {/* No target, no PR — just what you're about to do. Tracking during
              and after the session is where the useful numbers live. */}
          <View style={styles.readyState}>
            <View style={styles.readyIcon}>
              <SymbolView name={ACTIVITY_ICONS[routine.activityType]} size={32} tintColor={colors.primary} />
            </View>
            <ThemedText type="heading">{routine.name}</ThemedText>
          </View>
        </ScrollView>

        <Pressable style={styles.primaryButton} onPress={start}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            Start
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/** Live GPS distance in the DSEG7 face, ghosted like TimerText — it's a live readout, not a summary stat. */
function LiveDistanceText({ miles, unitSystem }: { miles: number; unitSystem: UnitSystem }) {
  const display = `${toDisplayDistance(miles, unitSystem)}`;
  const ghost = display.replace(/\d/g, '8');

  return (
    <View>
      <ThemedText type="timerSmall" style={styles.distanceGhost} aria-hidden>
        {ghost}
      </ThemedText>
      <ThemedText type="timerSmall">{display}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  overviewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  exerciseHeader: {
    gap: Spacing.half,
  },
  readyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  readyIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  recoveryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  recoverySave: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  recoveryDiscard: {
    paddingVertical: Spacing.two,
  },
  captionRow: {
    textAlign: 'center',
  },
  liveBody: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  dimmed: {
    opacity: 0.45,
  },
  timerArea: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  liveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  liveStatColumn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  elevationSlot: {
    width: '100%',
  },
  distanceGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.06,
  },
  distanceCard: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  distanceInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
  },
  secondaryButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  finishedContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  finishedHeader: {
    gap: Spacing.one,
  },
});
