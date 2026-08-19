-- Nutrition (Phase 2): food logging by meal, personal recipe book, and daily
-- calorie/macro targets. Nutrients are snapshotted onto each row at log time
-- (per-100g source data lives only in the USDA FoodData Central lookup), so history
-- never shifts when a source food changes.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

-- ---------------------------------------------------------------------------
-- food_logs: one row per logged food/recipe serving, keyed to a date + meal.
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  brand text,
  -- Amount logged, canonical grams. Null for serving-based entries (recipes).
  grams numeric,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recipes + recipe_ingredients: the personal recipe book. Ingredient macros
-- are for the whole recipe; logging divides by servings.
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  servings numeric not null default 1,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  grams numeric,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- nutrition_goals: one row per user with daily intake targets.
-- ---------------------------------------------------------------------------
create table public.nutrition_goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calories numeric not null default 2000,
  protein_g numeric not null default 140,
  carbs_g numeric not null default 220,
  fat_g numeric not null default 65,
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, date desc);
create index recipes_user_idx on public.recipes (user_id, position);
create index recipe_ingredients_user_idx on public.recipe_ingredients (user_id);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

-- ---------------------------------------------------------------------------
-- Row Level Security (same pattern as 0001; the loop there doesn't cover
-- tables added later, so repeat it here).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'food_logs',
    'recipes',
    'recipe_ingredients',
    'nutrition_goals'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows select" on public.%I for select using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows update" on public.%I for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
