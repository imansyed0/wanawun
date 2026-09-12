import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Configure both in local .env and in your EAS production environment.'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getStorage() {
  if (typeof window !== 'undefined') {
    try {
      return require('@react-native-async-storage/async-storage').default;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: getStorage(),
          autoRefreshToken: true,
          persistSession: typeof window !== 'undefined',
          // app/auth/callback.tsx exchanges the auth code itself on every
          // platform. Letting supabase-js do it on web instead would break
          // password resets: its PKCE branch discards the recovery marker
          // (returns redirectType: null) and consumes the code verifier, so
          // the callback can neither exchange the code nor tell a recovery
          // link apart from a sign-in.
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      });
    }
    return (_supabase as any)[prop];
  },
});
