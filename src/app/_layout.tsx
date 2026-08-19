import {
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppIntro, SPLASH_FADE_MS } from '@/components/app-intro';
import { Colors } from '@/constants/theme';
// Side-effect import: registers the background location task. iOS can deliver
// fixes after a cold start, so defineTask has to run before any screen mounts.
import '@/lib/cardio-tracking';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { StoreProvider, useStore } from '@/providers/store-provider';

SplashScreen.preventAutoHideAsync();
// Cross-fade the native splash into AppIntro. The splash is a bare colour hold
// (no image — see app.json), so the mark is drawn exactly once, by AppIntro:
// drawing the wordmark on both sides of this hand-off is what used to make the
// old logo flash on top of the native splash.
SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE_MS });

// GitFit uses a fixed always-dark palette rather than following the system
// appearance — see Colors in @/constants/theme.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: 'transparent',
  },
};

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, isLoading } = useAuth();
  const { isHydrated } = useStore();
  // Once per launch, not per auth flip: RootNavigator only unmounts on a cold
  // start, so signing out mid-session doesn't replay the intro.
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  // Wait for the stored session and the hydrated store before choosing a
  // stack, so a logged-in user never sees the login screen flash and screens
  // never render on empty data. The native splash covers this whole gap — it
  // is only dismissed once fonts, auth and the store have all settled, so
  // there is never a blank frame between splash and first screen.
  const ready = fontsLoaded && !isLoading && isHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const onboarded = session?.user.user_metadata?.onboarded === 'true';

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout/choose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="workout/[id]" />
          <Stack.Screen name="cardio/[id]" />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="history/cardio/index" />
          <Stack.Screen name="history/cardio/[id]" />
          <Stack.Screen name="routine/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="cardio-routine/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="food/search" options={{ presentation: 'modal' }} />
          <Stack.Screen name="food/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="food/goals" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipes" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe/[id]" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      {/* Mounted over an already-rendered stack, so the first screen is laid
          out and ready by the time the intro dissolves — no blank frame. */}
      {introDone ? null : <AppIntro onFinished={finishIntro} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    'DSEG7Classic-Bold': require('../../assets/fonts/DSEG7Classic-Bold.ttf'),
    'DSEG7Classic-Regular': require('../../assets/fonts/DSEG7Classic-Regular.ttf'),
  });

  // No early return on !fontsLoaded: RootNavigator owns dismissing the splash
  // and has to stay mounted to do it.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <StoreProvider>
            <RootNavigator fontsLoaded={fontsLoaded} />
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
