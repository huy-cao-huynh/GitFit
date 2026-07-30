import * as Haptics from 'expo-haptics';

/**
 * expo-haptics rejects with "not available" on hardware without a Taptic
 * Engine (the iOS Simulator) — swallow that instead of an uncaught promise
 * rejection surfacing as a red-screen error on every haptic call.
 */
function safe(promise: Promise<void>) {
  promise.catch(() => {});
}

export const haptics = {
  selection: () => safe(Haptics.selectionAsync()),
  impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => safe(Haptics.impactAsync(style)),
  notification: (type: Haptics.NotificationFeedbackType) => safe(Haptics.notificationAsync(type)),
};
