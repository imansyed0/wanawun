import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { nativeGoogleSignIn } from '@/src/lib/googleSignIn';
import { clearClipProgressCache } from '@/src/services/clipProgressService';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/src/types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user);
      }
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user);
      }
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(user: User) {
    try {
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (existingProfile) {
        setProfile(existingProfile);
        return;
      }

      const displayName =
        typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()
          ? user.user_metadata.display_name.trim()
          : user.email?.split('@')[0] ?? 'Player';

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: displayName,
        })
        .select('*')
        .single();

      if (insertError) {
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (retryError) throw retryError;
        if (!retryProfile) throw insertError;
        setProfile(retryProfile);
        return;
      }

      setProfile(insertedProfile);
    } catch (error) {
      console.error('Failed to load or create profile', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const idToken = await nativeGoogleSignIn();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await clearClipProgressCache();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };
}
