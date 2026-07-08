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
- `(tabs)/_layout.tsx`: JS `Tabs` from `expo-router/js-tabs` with a custom `tabBar` — `GlassTabBar` (`src/components/glass-tab-bar.tsx`), a floating dark pill with SF-symbol icons and a reanimated sliding indicator. 5 tabs: dashboard, history, progress, workouts, settings.
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

# Conventions

- Reuse `ThemedText` / `ThemedView` (`src/components/`) and `Colors` / `Palette` / `RingColors` / `Spacing` / `Fonts` from `src/constants/theme.ts` — no hardcoded spacing or colors.
- GitFit uses a **single fixed dark theme**, not the OS light/dark setting: near-black `Colors.background` (`#0D0B14`) with translucent "glass" surfaces (`backgroundElement`) over `GlowBackground` (`src/components/glow-background.tsx`) ombre halos. `useTheme()` just returns `Colors` — there is no scheme context anymore; don't reintroduce OS-based scheme switching or a light theme.
- Palette (`Palette` in theme.ts): periwinkle `#7678ed` is the primary accent (CTAs, active tab); deep purple `#3d348b` is for background glows ONLY (fails contrast as text/marks); yellow/orange/red-orange are for rings, chart series, and warm glows. Chart series colors: Steps = yellow, Bodyweight = periwinkle, Strength = orange — one series per chart, never orange + red-orange together.
- Font is DM Sans (`@expo-google-fonts/dm-sans`, loaded in the root layout) — `Fonts.regular/medium/semibold/bold` map to the loaded weights.
- Charts are hand-rolled `react-native-svg` (`line-chart.tsx`, `contribution-grid.tsx`, `activity-rings.tsx`) — no chart library.
- Kebab-case file names (`auth-provider.tsx`), `StyleSheet.create` at the bottom of the file.
- Primary action color: `Colors.accent` (`#7678ed`); destructive: `Destructive` (red-orange `#f35b04`).
- Screens under the tab bar pad scrollable content with `BottomTabInset` so it clears the floating pill.

# Testing & verification

There is no test suite yet. Verify changes with, in order:
1. `npx tsc --noEmit` — must pass. (If it complains about missing `expo-env.d.ts` / CSS module types on a fresh clone, or about a route string you just added, run `npx expo start` once to regenerate typed routes.)
2. `npm run lint` — must pass clean, no known pre-existing errors.
3. Metro bundle smoke test (catches broken imports across all routes): start `npx expo start --port 8090` and curl `http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true` — expect HTTP 200.
4. **No Xcode on this Mac** (Command Line Tools only) — there is no iOS simulator. Real-device testing happens via Expo Go: `npm start`, then the user scans the QR code. Ask the user to verify device-only behavior (tab bar rendering, sliders, drag-reorder, OAuth redirect, keyboard handling).

When adding a test framework later, prefer `jest-expo` + React Native Testing Library.
