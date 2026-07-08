import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials are missing. Copy .env.example to .env and fill in your project values.'
  );
}

// Placeholder fallbacks keep the app booting (to the login screen) when .env is
// missing; auth calls will fail with a visible error instead of crashing at startup.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Session tokens arrive via deep link and are handled manually in the auth provider.
      detectSessionInUrl: false,
    },
  }
);

// Supabase only refreshes sessions while `startAutoRefresh` is active, so tie it
// to the app being foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
