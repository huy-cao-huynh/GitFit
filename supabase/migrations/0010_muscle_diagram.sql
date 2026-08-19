-- Anatome muscle-diagram integration: per-exercise primary/secondary muscle
-- slugs, resolved from the Anatome exercise-lookup search (routine editor) or
-- a local keyword fallback for custom exercise names (see src/lib/muscles.ts
-- anatomeSlugsFor). session_exercises gets its own copy so a completed
-- session's muscle diagram stays accurate even if the source routine is later
-- edited or deleted (same snapshot pattern already used for `name`).
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

alter table public.routine_exercises
  add column primary_muscles text[],
  add column secondary_muscles text[];

alter table public.session_exercises
  add column primary_muscles text[],
  add column secondary_muscles text[];

-- No new RLS needed: plain columns on tables already covered by the RLS
-- policies from 0001_initial_schema.sql.
