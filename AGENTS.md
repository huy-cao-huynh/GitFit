# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project summary

GitFit (repo/slug MyGymApp) — a personal iOS gym-tracking app (single user, portrait-only). Expo SDK 57 + Expo Router v57, React 19, TypeScript strict. Web/Android are not targets; iOS-first decisions (SF Symbols via `expo-symbols`) are intentional.

Roadmap (in priority order):
1. ✅ Login (Supabase email/password + Google OAuth) — done
2. ✅ Workout logging: custom routines (create/edit in the Workouts tab), per-set reps/weight logging with steppers, rest timer, drag-reorder queue mid-session — done
3. ✅ History list with per-set detail + calendar (merged into Progress/Log) — done
4. ✅ Progress: strength graphs per movement + body-weight and steps tracking — done (steps are empty until HealthKit)
5. ✅ Supabase tables + RLS replacing the local AsyncStorage store — done (`supabase/migrations/`, `src/lib/store/remote.ts`)
6. ✅ Design overhaul "Electric. Editorial. Alive.": GitFit brand mark + app icons, near-black electric palette, Fraunces/DSEG7 type mix, bento layouts, floating pill tab bar, haptics — done
7. ✅ Nutrition tab: meal/calorie/macro logging via Open Food Facts, recipe book, daily nutrition goals (6th tab; requires migration 0005) — done
8. Workout-session upgrade: previous-set/PR hints, per-exercise skip, richer end-early flows
9. Customizable goals + body metrics move from Log to Progress
10. Apple Health / calorie sync (settings toggle is a disabled placeholder; the steps series stays empty until then)

# Architecture

- Routes live in `src/app/` (NOT root `app/`). Path alias `@/*` → `./src/*`.
- Root `_layout.tsx`: `GestureHandlerRootView` → dark nav theme → `AuthProvider` → `StoreProvider` → `Stack` with `Stack.Protected` guards keyed on the Supabase session — never add manual login redirects; flipping the guard handles navigation. `RootNavigator` also gates on `useStore().isHydrated`.
- `(tabs)/_layout.tsx`: JS `Tabs` from `expo-router/js-tabs` with a custom `tabBar` — `TabBar` (`src/components/tab-bar.tsx`), a floating pill bar (inset from the screen edges, `Radius.full`, opaque `surface` + 1px border) with SF-symbol icons and a reanimated `surfaceElevated` pill that slides behind the active tab; tab presses fire `Haptics.selectionAsync()`. 5 tabs: dashboard, logging (titled "Log"), progress, workouts, settings. Scrollable tab content pads with `BottomTabInset` to clear the floating bar.
- `workout/choose.tsx`: modal picker for which routine to start, pushed from the dashboard's Start Workout button.
- `workout/[id].tsx`: active-session screen, full-screen push. State machine: idle (overview + Start Workout) → per set: Start Set → sliders (reps/weight) → Complete Set → rest countdown → next. Saves a `Session` to the store on finish. Timers recompute from wall-clock timestamps, never tick counts.
- `history/[id].tsx`: per-session detail (sets × reps × weight + duration/calories).
- `routine/[id].tsx` (modal): create (`id === 'new'`) / edit / delete routines.
- `(tabs)/logging.tsx` ("Log"): weekly goal targets, daily check-off definitions, calendar week strip, water/body-weight/measurement quick-logging; linked from the dashboard Today section (there is no separate `goals.tsx` modal).
- `(tabs)/nutrition.tsx` ("Food"): day-by-day meal log (breakfast/lunch/dinner/snacks) with a calorie/macro summary vs. editable daily targets (`nutrition_goals`). Food rows push the `food/[id]` edit modal; per-meal Add Food pushes `food/search` (Open Food Facts text search via `src/lib/nutrition/open-food-facts.ts`, custom manual foods, and one-tap recipe-serving logging). `recipes` + `recipe/[id]` modals are the personal recipe book (manual ingredients; whole-recipe macros ÷ servings). Nutrients are snapshotted onto `food_logs` rows at log time — editing an amount rescales the snapshot proportionally; per-100g data never persists. Nutrition tables fetch separately in `fetchNutritionData` so a project without migration 0005 degrades to empty slices instead of failing hydration.
- **Data layer**: `StoreProvider` / `useStore()` (`src/providers/store-provider.tsx`) hydrates the whole per-user dataset from Supabase on login (`fetchStoreData` in `src/lib/store/remote.ts`) and mirrors each mutator with a fire-and-forget remote write after an optimistic in-memory update — screens never talk to Supabase directly. App types live in `src/lib/store/types.ts` (camelCase) and map 1:1 to the snake_case tables in `supabase/migrations/0001_initial_schema.sql`. Pure selectors live in `derive.ts` — screens stay declarative. Row ids are client-generated UUIDs (`makeId` in `src/lib/store/id.ts`, via `expo-crypto`). First login writes default goals (`src/lib/store/seed.ts`); everything else starts empty.
- Auth state: `useAuth()` from `src/providers/auth-provider.tsx` (also `updateProfile`/`updateEmail`/`updatePassword`; name & birthday live in Supabase `user_metadata`). Supabase client: `src/lib/supabase.ts`.

# Integrations

- **Open Food Facts**: free, key-less nutrition lookup (`src/lib/nutrition/open-food-facts.ts`, `cgi/search.pl` text search, per-100g macros, custom User-Agent per their API guidelines). Only the search screen talks to it; logged entries never reference it again.
- **Supabase**: auth, profile metadata, and all workout/goal/health data (per-user tables with RLS; schema in `supabase/migrations/`, applied via the dashboard SQL editor). Every table keys rows on `user_id default auth.uid()` with select/insert/update/delete policies scoped to the owner, so the client never sends `user_id`. Credentials come from `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never commit `.env`; update `.env.example` when adding new vars. Restart the dev server after changing `.env`.
- **Google login**: browser OAuth via `expo-web-browser` + `supabase.auth.signInWithOAuth` (see `signInWithGoogle` in the auth provider). Redirect URLs must be registered in the Supabase dashboard.
- **Apple Health**: not integrated yet; will require a dev build (not Expo Go) when added. The Progress "Steps" series reads `StepsEntry[]` from the store — HealthKit will fill the same interface.

# Conventions — design language: "Electric. Editorial. Alive."

The app reads as a high-energy, editorial training tool: near-black canvas with radial glows and subtle dot-grid texture, an electric blue primary family, a volt-lime accent for wins, serif display type over sans body, seven-segment digits for anything that counts. Cards stay opaque with thin borders — still NO glassmorphism, frosted/translucent surfaces, or drop shadows.

- Reuse `ThemedText` / `ThemedView` (`src/components/`) and `Colors` / `Gradients` / `RingColors` / `ChartColors` / `Radius` / `Motion` / `Spacing` / `Fonts` / `Type` from `src/constants/theme.ts` — no hardcoded spacing, radii, durations, colors, or font sizes.
- **Single fixed dark theme**, not the OS light/dark setting: `background` `#08080D` (near-black, blue cast), opaque card `surface` `#14141B`, raised controls `surfaceElevated` `#1E1E28` (steppers, segmented tracks, dropdowns, tab pill). `useTheme()` just returns `Colors` — no scheme context; don't reintroduce OS-based scheme switching or a light theme.
- **Primary blue family**: `primary` `#3D8BFD` (≈6:1 on background — passes AA for normal text), `primaryLight` `#7EB3FF` (small accent text, links, icons, active tab), `primaryDark` `#1D4ED8` (gradient dark stop). **Volt accent**: `volt` `#D4F53C` for streaks, PRs, success highlights, and at most one inverted bright card per screen (dark text on volt — `Colors.background`, ≈16:1). Semantic: `success` `#22C55E`, `warning` `#F59E0B`, `danger` `#EF4444`. Content on primary fills is `Colors.text`; content on volt fills is `Colors.background`.
- **Backgrounds**: screens wrap content in `ScreenBackground` (`src/components/screen-background.tsx`) — base color + top radial glow, optional `pattern="dots"` texture and angular corner `shapes`. This is the only sanctioned background decoration; keep glows/patterns faint (borders and hierarchy still do the work).
- **Cards**: opaque `surface` fill + `Radius.lg` (20) + 1px `Colors.border` (`rgba(120,160,255,0.10)`, blue-tinted) + `Spacing.three/four` padding. Buttons/inputs `Radius.md` (16), inner chips/segments `Radius.sm` (12). Never use `Spacing.*` as a borderRadius. Prefer bento variety over uniform full-width stacks: mixed tile sizes (`flexBasis '47%'` grids, asymmetric rows) like the dashboard rings row and Progress stat tiles.
- **Gradients** via `GradientFill` (`src/components/gradient-fill.tsx`; multi-`stops`, `angle`, `radial`; parent needs `overflow: 'hidden'` + radius) with definitions from `Gradients` in theme.ts: `cta` (buttons), `ctaHero` (the Start Workout hero), `cardAccent` (faint card/icon washes), `screenGlow` (ScreenBackground only). No `expo-linear-gradient` — everything is `react-native-svg`. Gradient text is still off-limits.
- **Data colors**: `RingColors` (dashboard/finished rings, outermost first) and `ChartColors` (one series per chart: steps/bodyweight = primaryLight, strength/water = primary, cardio = volt, calories = warning) live in theme.ts — change them there, not per-screen.
- **Motion**: all animations `withTiming` with `Motion.fast/base/slow` (150/200/250 ms) — no springs, no long animations. Count-up numbers (`AnimatedNumber`, 800 ms ease-out) are the one sanctioned longer animation.
- **Fonts — three voices** (loaded in the root layout): Manrope (`Fonts.regular/medium/semibold/bold`) for body/UI; Fraunces serif (`Fonts.display/displayBold/displayItalic` via `@expo-google-fonts/fraunces`) for display headings — `ThemedText` `display`/`title`/`subtitle`; DSEG7 Classic (`Fonts.timer/timerLight`, bundled in `assets/fonts/` with its OFL license) for timers and big counters — `ThemedText` `timer`/`timerSmall`/`numeric`, or `TimerText` (LCD ghost layer + tick pulse) and `AnimatedNumber` (count-up). DSEG is digits-only — never set labels in it. Sizes come from the `Type` scale in theme.ts. For emphasis inside display copy, nest `type="displayItalic"` (serif italic) — the sans-plus-italic-serif mix is the house style.
- **Haptics** (`expo-haptics`): `selectionAsync` on tab/segment switches, `impactAsync(Light)` on set completion, `notificationAsync(Success)` when a countdown finishes. Keep haptics on meaningful moments only.
- **Brand**: the "commit-graph dumbbell" mark — geometry in `src/constants/brand.ts`, rendered in-app by `GitFitLogo` (`src/components/gitfit-logo.tsx`). App icons/splash/favicon PNGs are generated from the same geometry by `npm run generate:brand` (`scripts/generate-brand-assets.mjs`, dev-only `sharp`); regenerate instead of hand-editing PNGs, and keep the script's inlined geometry in sync with `brand.ts`.
- Charts are hand-rolled `react-native-svg` (`line-chart.tsx` — pass `sparkline` for compact tiles; `contribution-grid.tsx` — dot-matrix, pass `inverted` on bright cards; `activity-rings.tsx`) — no chart library.
- Kebab-case file names (`auth-provider.tsx`), `StyleSheet.create` at the bottom of the file. Shared helpers: `formatDuration` in `src/lib/format.ts`, `SummaryStat` in `src/components/summary-stat.tsx` (pass `animatedValue` for count-up) — don't re-declare them per screen.
- Routine `tileColor` is still stored in Supabase but is no longer read for rendering (legacy rows hold old-palette values); routine tiles render an SF-symbol over a `cardAccent` wash.
- Screens under the tab bar pad scrollable content with `BottomTabInset` (120) so it clears the floating bar.

# Testing & verification

There is no test suite yet. Verify changes with, in order:
1. `npx tsc --noEmit` — must pass. (If it complains about missing `expo-env.d.ts` / CSS module types on a fresh clone, or about a route string you just added, run `npx expo start` once to regenerate typed routes.)
2. `npm run lint` — must pass clean, no known pre-existing errors.
3. Metro bundle smoke test (catches broken imports across all routes): start `npx expo start --port 8090` and curl `http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true` — expect HTTP 200.
4. iOS simulator testing: Xcode is installed (iPhone 17 simulators) — `npx expo start` then press `i` installs an SDK-matching Expo Go in the simulator automatically. Real-device testing via Expo Go on the user's iPhone (`npm start` + QR scan; keep the phone's Expo Go updated so its SDK matches). Ask the user to verify device-only feel (haptics, sliders, drag-reorder, keyboard handling); OAuth redirects work in the simulator too.

When adding a test framework later, prefer `jest-expo` + React Native Testing Library.
