import { supabase } from '@/lib/supabase';

/**
 * Looks up whether `email` already has an account, via the `email_exists`
 * Postgres RPC (see supabase/migrations/0004_add_email_exists_function.sql) —
 * used to route the login screen between its sign-in and sign-up steps.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_exists', { check_email: email });
  if (error) throw error;
  return data === true;
}
