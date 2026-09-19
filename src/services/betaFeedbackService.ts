import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';

/** Matches the length check on beta_feedback.feedback (011). */
export const MAX_BETA_FEEDBACK_LENGTH = 2000;

// Which build the report came from. Read once: it can't change while the app is
// running, and a report without it is impossible to place against a TestFlight
// or Play build.
const APP_VERSION = Constants.expoConfig?.version ?? null;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Send one piece of beta-test feedback. Throws on failure so the caller can
 * keep the typed text on screen and offer a retry — losing someone's words is
 * worse than making them press send twice.
 *
 * TEMPORARY (beta only): delete this file when the beta ends.
 */
export async function submitBetaFeedback(feedback: string): Promise<void> {
  const text = feedback.trim();
  if (!text) throw new Error('Feedback is empty');

  const { error } = await supabase.from('beta_feedback').insert({
    feedback: text,
    user_id: await currentUserId(),
    platform: Platform.OS,
    app_version: APP_VERSION,
  });
  if (error) throw error;
}
