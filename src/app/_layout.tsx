import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { StoreProvider, useStore } from '@/providers/store-provider';

SplashScreen.preventAutoHideAsync();

// GitFit uses a fixed always-dark palette rather than following the system
// appearance — see Colors in @/constants/theme.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: 'transparent',
  },
};

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { isHydrated } = useStore();

  // Wait for the stored session and the hydrated store before choosing a
  // stack, so a logged-in user never sees the login screen flash and screens
  // never render on empty data. The splash overlay covers this gap.
  if (isLoading || !isHydrated) return null;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/choose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="cardio/[id]" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="routine/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cardio-routine/[id]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <StoreProvider>
            <AnimatedSplashOverlay />
            <RootNavigator />
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
