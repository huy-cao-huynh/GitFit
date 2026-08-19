-- Recipes get a second authoring mode. `entry_mode = 'ingredients'` (the
-- default, and how every existing row behaves) derives macros by summing
-- recipe_ingredients. `entry_mode = 'macros'` skips ingredients entirely and
-- stores the numbers straight off a nutrition label — the right shape for a
-- branded item that isn't in the food database, e.g. a specific protein
-- shake, where there is nothing to itemise.
--
-- The macro columns hold ONE SERVING, not the whole recipe: that's what a
-- label reads, and quantity is already chosen when logging. Ingredient-mode
-- rows leave them at 0 and are unaffected.
--
-- Apply by pasting this whole file into the Supabase dashboard SQL Editor and
-- running it once.

alter table public.recipes
  add column if not exists entry_mode text not null default 'ingredients'
    check (entry_mode in ('ingredients', 'macros')),
  add column if not exists calories numeric not null default 0,
  add column if not exists protein_g numeric not null default 0,
  add column if not exists carbs_g numeric not null default 0,
  add column if not exists fat_g numeric not null default 0;

-- No new RLS needed: plain columns on a table already covered by the policies
-- from 0005_add_nutrition.sql.
