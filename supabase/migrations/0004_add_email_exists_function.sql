-- RPC for the login screen: checks whether an email already has an account
-- so it can route between the sign-in and sign-up steps. auth.users isn't
-- exposed to anon/authenticated directly, so this security-definer function
-- exposes only a boolean instead of granting table access.
create function public.email_exists(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;
