import { isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';

/**
 * Maps a thrown sign-in/sign-up error to user-facing copy. Raw Supabase
 * messages (e.g. "Invalid login credentials") must never reach the UI —
 * everything funnels through here, including the generic catch-all.
 */
export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (isAuthWeakPasswordError(error)) {
    return 'Choose a stronger password (at least 6 characters).';
  }

  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'Incorrect email or password.';
      case 'email_not_confirmed':
        return 'Please confirm your email first — check your inbox for the confirmation link.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'user_already_exists':
        return 'An account with this email already exists — try signing in instead.';
      case 'weak_password':
        return 'Choose a stronger password (at least 6 characters).';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}
