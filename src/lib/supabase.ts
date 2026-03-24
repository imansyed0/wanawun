import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL. Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

// Lazy-load AsyncStorage to avoid SSR "window is not defined" crash
let _supabase: SupabaseClient | null = null;

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
