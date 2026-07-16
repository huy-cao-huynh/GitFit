# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project summary

MyGymApp — a personal iOS gym-tracking app (single user, portrait-only). Expo SDK 57 + Expo Router v57, React 19, TypeScript strict. Web/Android are not targets; iOS-first decisions (SF Symbols via `expo-symbols`) are intentional.

MVP roadmap (in priority order):
1. ✅ Login (Supabase email/password + Google OAuth) — done
2. ✅ Workout logging: custom routines (create/edit in the Workouts tab), per-set reps/weight logging with sliders, rest timer, drag-reorder queue mid-session — done (local store)
3. ✅ History list with per-set detail + calendar (merged into Progress: week/month/year views) — done (local store)
4. ✅ Progress: strength graphs per movement + body-weight and steps tracking — done (steps are seeded data until HealthKit)
5. ✅ Supabase tables + RLS replacing the local AsyncStorage store — done (`supabase/migrations/`, `src/lib/store/remote.ts`)
6. Apple Health / calorie sync (settings toggle is a disabled placeholder; the steps series stays empty until then)

# Architecture

- Routes live in `src/app/` (NOT root `app/`). Path alias `@/*` → `./src/*`.
- Root `_layout.tsx`: `GestureHandlerRootView` → dark nav theme → `AuthProvider` → `StoreProvider` → `Stack` with `Stack.Protected` guards keyed on the Supabase session — never add manual login redirects; flipping the guard handles navigation. `RootNavigator` also gates on `useStore().isHydrated`.
- `(tabs)/_layout.tsx`: JS `Tabs` from `expo-router/js-tabs` with a custom `tabBar` — `TabBar` (`src/components/tab-bar.tsx`), an anchored full-width matte bar (opaque `surface`, thin top border) with SF-symbol icons and a reanimated `surfaceElevated` pill that slides behind the active tab. 5 tabs: dashboard, history, progress, workouts, settings.
- `workout/choose.tsx`: modal picker for which routine to start, pushed from the dashboard's Start Workout button.
- `workout/[id].tsx`: active-session screen, full-screen push. State machine: idle (overview + Start Workout) → per set: Start Set → sliders (reps/weight) → Complete Set → rest countdown → next. Saves a `Session` to the store on finish. Timers recompute from wall-clock timestamps, never tick counts.
- `history/[id].tsx`: per-session detail (sets × reps × weight + duration/calories).
- `routine/[id].tsx` (modal): create (`id === 'new'`) / edit / delete routines.
- `goals.tsx` (modal): weekly targets + daily check-off definitions; reachable from the dashboard Today section and Settings.
- **Data layer**: `StoreProvider` / `useStore()` (`src/providers/store-provider.tsx`) hydrates the whole per-user dataset from Supabase on login (`fetchStoreData` in `src/lib/store/remote.ts`) and mirrors each mutator with a fire-and-forget remote write after an optimistic in-memory update — screens never talk to Supabase directly. App types live in `src/lib/store/types.ts` (camelCase) and map 1:1 to the snake_case tables in `supabase/migrations/0001_initial_schema.sql`. Pure selectors live in `derive.ts` — screens stay declarative. Row ids are client-generated UUIDs (`makeId` in `src/lib/store/id.ts`, via `expo-crypto`). First login writes default goals (`src/lib/store/seed.ts`); everything else starts empty.
- Auth state: `useAuth()` from `src/providers/auth-provider.tsx` (also `updateProfile`/`updateEmail`/`updatePassword`; name & birthday live in Supabase `user_metadata`). Supabase client: `src/lib/supabase.ts`.

# Integrations

- **Supabase**: auth, profile metadata, and all workout/goal/health data (per-user tables with RLS; schema in `supabase/migrations/`, applied via the dashboard SQL editor). Every table keys rows on `user_id default auth.uid()` with select/insert/update/delete policies scoped to the owner, so the client never sends `user_id`. Credentials come from `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never commit `.env`; update `.env.example` when adding new vars. Restart the dev server after changing `.env`.
- **Google login**: browser OAuth via `expo-web-browser` + `supabase.auth.signInWithOAuth` (see `signInWithGoogle` in the auth provider). Redirect URLs must be registered in the Supabase dashboard.
- **Apple Health**: not integrated yet; will require a dev build (not Expo Go) when added. The Progress "Steps" series reads `StepsEntry[]` from the store — HealthKit will fill the same interface.

# Conventions — design language: "Precision. Focus. Momentum."

The app reads as a premium matte training tool, not a flashy fitness app: matte charcoal surfaces, one blue primary family, thin borders instead of shadows/glows, strong hierarchy, fast restrained motion. NO glassmorphism, frosted/translucent surfaces, background glows, drop shadows, or competing accent hues — do not reintroduce them.

- Reuse `ThemedText` / `ThemedView` (`src/components/`) and `Colors` / `RingColors` / `ChartColors` / `Radius` / `Motion` / `Spacing` / `Fonts` from `src/constants/theme.ts` — no hardcoded spacing, radii, durations, or colors.
- **Single fixed dark theme**, not the OS light/dark setting: `background` `#121212`, opaque card `surface` `#1C1C1E`, raised controls `surfaceElevated` `#25252B` (steppers, segmented tracks, dropdowns, tab pill). `useTheme()` just returns `Colors` — no scheme context; don't reintroduce OS-based scheme switching or a light theme.
- **Primary blue family**: `primary` `#2563EB` (fills + large/bold text only — 3.7:1 on the background, fails for small text), `primaryLight` `#60A5FA` (small accent text, links, icons, active tab), `primaryDark` `#1D4ED8` (gradient dark stop). Semantic: `success` `#22C55E`, `warning` `#F59E0B`, `danger` `#EF4444`. Content on primary fills is `Colors.text`, never `Colors.background`.
- **Cards**: opaque `surface` fill + `Radius.lg` (20) + 1px `Colors.border` (`rgba(255,255,255,0.08)`) + `Spacing.three/four` padding. Buttons/inputs `Radius.md` (16), inner chips/segments `Radius.sm` (12). Never use `Spacing.*` as a borderRadius.
- **Gradients** appear ONLY on progress rings, progress bars, charts, primary CTA buttons, and achievement/PR indicators — never on backgrounds, cards, large containers, or text. Primary CTAs use `GradientFill` (`src/components/gradient-fill.tsx`, svg `primary → primaryDark`; parent needs `overflow: 'hidden'` + radius). No `expo-linear-gradient` — everything is `react-native-svg`.
- **Data colors**: `RingColors` (dashboard/finished rings, outermost first) and `ChartColors` (one series per chart: steps/bodyweight = primaryLight, strength/water = primary, cardio = success, calories = warning) live in theme.ts — change them there, not per-screen.
- **Motion**: all animations `withTiming` with `Motion.fast/base/slow` (150/200/250 ms) — no springs, no long animations.
- Font is DM Sans (`@expo-google-fonts/dm-sans`, loaded in the root layout) — `Fonts.regular/medium/semibold/bold` map to the loaded weights.
- Charts are hand-rolled `react-native-svg` (`line-chart.tsx`, `contribution-grid.tsx`, `activity-rings.tsx`) — no chart library.
- Kebab-case file names (`auth-provider.tsx`), `StyleSheet.create` at the bottom of the file.
- Routine `tileColor` is still stored in Supabase but is no longer read for rendering (legacy rows hold old-palette values); routine tiles render `Colors.primaryTint`.
- Screens under the tab bar pad scrollable content with `BottomTabInset` (96) so it clears the anchored bar.

# Testing & verification

There is no test suite yet. Verify changes with, in order:
1. `npx tsc --noEmit` — must pass. (If it complains about missing `expo-env.d.ts` / CSS module types on a fresh clone, or about a route string you just added, run `npx expo start` once to regenerate typed routes.)
2. `npm run lint` — must pass clean, no known pre-existing errors.
3. Metro bundle smoke test (catches broken imports across all routes): start `npx expo start --port 8090` and curl `http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true` — expect HTTP 200.
4. iOS simulator testing: Xcode is installed (iPhone 17 simulators) — `npx expo start` then press `i` installs an SDK-matching Expo Go in the simulator automatically. Real-device testing via Expo Go on the user's iPhone (`npm start` + QR scan; keep the phone's Expo Go updated so its SDK matches). Ask the user to verify device-only feel (haptics, sliders, drag-reorder, keyboard handling); OAuth redirects work in the simulator too.

When adding a test framework later, prefer `jest-expo` + React Native Testing Library.
