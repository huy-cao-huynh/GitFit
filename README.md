# GitFit

A personal, single-user iOS gym-tracking app. Custom routines, per-set logging with a rest timer, GPS-tracked cardio, nutrition logging against USDA FoodData Central, strength/body-metric progress charts, and fully user-defined weekly goals — all backed by Supabase with row-level security.

Built with Expo SDK 57, Expo Router, React 19, and TypeScript (strict). iOS-first and portrait-only by design; web and Android are not targets.

## Features

- **Auth** — Supabase email/password + Google OAuth.
- **Workout logging** — custom routines built in-app, per-set reps/weight logging with steppers, a wall-clock rest timer, and mid-session drag-reorder of the exercise queue. Tracks previous-set/PR hints, per-exercise skip, and a save-or-discard end flow, with a plate-by-plate PR celebration animation.
- **Cardio** — dedicated cardio routines (activity type, target time/distance) with a live GPS-tracked session screen (route, elevation, pace, splits).
- **History** — full session log with per-set detail and a calendar view.
- **Progress** — strength graphs per movement, body-weight/BMI/measurement trend charts, and step tracking (empty until Apple Health is wired up).
- **Nutrition** — day-by-day meal logging with macro targets, USDA FoodData Central search, custom manual foods, and a personal recipe book.
- **Goals** — arbitrary weekly goals, either computed from logged data (workouts, calories, cardio, water) or manual +1 check-ins, plus daily check-off habits with streaks.
- **Strava** — sync in progress.

## Tech stack

- **Framework**: Expo SDK 57, Expo Router (file-based routing), React 19, React Native 0.86
- **Language**: TypeScript, strict mode
- **Backend**: Supabase (Postgres + RLS, auth, storage) — see `supabase/migrations/`
- **State**: a single `StoreProvider`/`useStore()` hydrated from Supabase on login, with optimistic local mutations mirrored to remote writes (`src/lib/store/`)
- **Animation**: React Native Reanimated 4
- **Charts/graphics**: hand-rolled `react-native-svg` (no charting library)
- **Fonts**: Manrope (body), Fraunces (headers & numerals), DSEG7 Classic (live timers only)
- **Nutrition data**: USDA FoodData Central API
- **Maps/location**: `react-native-maps`, `expo-location`, `expo-task-manager` for GPS cardio tracking

## Getting started

### Prerequisites

- Node.js and npm
- A Supabase project
- A free [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup)
- Xcode + an iOS simulator (or a physical iPhone with Expo Go) — this app targets iOS only

### Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase and USDA credentials

   ```bash
   cp .env.example .env
   ```

3. Apply the database schema — run each file in `supabase/migrations/` in order via the Supabase dashboard SQL editor

4. Start the app

   ```bash
   npx expo start
   ```

   Press `i` to launch the iOS simulator, or scan the QR code with Expo Go on a physical device. Restart the dev server after changing `.env`.

## Project structure

```
src/
  app/            routes (Expo Router, file-based) — NOT the root app/
  components/     shared UI components
  constants/      theme tokens (colors, spacing, radii, type, motion)
  lib/            store, derive/selectors, nutrition, muscles, plates, format helpers
  providers/      auth + store context providers
supabase/
  migrations/     SQL schema, applied in order via the Supabase dashboard
  functions/      edge functions
```

Routes live under `src/app/`, with `@/*` aliased to `./src/*`. The data layer hydrates once on login (`fetchStoreData`), and screens read through pure selectors in `src/lib/store/derive.ts` rather than talking to Supabase directly.

## Design language

"Lime. Editorial. Grounded." — a flat near-black canvas with a print-halftone texture, one accent color (electric lime), a neutral grey ramp for data, serif for headers and numerals, sans for everything else, and seven-segment digits reserved for live timers only. No gradients, no glassmorphism, no OS light/dark switching — a single fixed dark theme.

## Verification

There's no automated test suite yet. Changes are verified with:

```bash
npx tsc --noEmit   # type check
npm run lint       # eslint
```

followed by manual testing in the iOS simulator or on a physical device via Expo Go.

## Roadmap

- [x] Login (Supabase + Google OAuth)
- [x] Workout logging with routines, sets, rest timer, drag-reorder
- [x] History + calendar
- [x] Progress: strength graphs, body-weight, steps
- [x] Supabase + RLS data layer
- [x] Nutrition logging (USDA FoodData Central, recipes, macro goals)
- [x] Workout-session UX upgrade (PR hints, skip, save/discard, countdown timer)
- [x] Customizable goals + body metrics
- [ ] Apple Health / calorie sync (steps stay empty until then)
- [ ] Design overhaul v2 — global foundations and Dashboard done; remaining tabs' layout/IA passes in progress
