import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Lazy-load AsyncStorage to avoid SSR "window is not defined" crash
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
  // Only use AsyncStorage on native/client-side web
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
          detectSessionInUrl: false,
        },
      });
    }
    return (_supabase as any)[prop];
  },
});
