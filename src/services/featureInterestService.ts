import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';

/** Features that are behind a fake door (see the feature_interest table). */
export type FeatureKey = 'koshur_clash';

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function insertInterest(row: {
  feature_key: FeatureKey;
  event_type: 'tap' | 'feedback';
  feedback: string | null;
}): Promise<void> {
  const { error } = await supabase.from('feature_interest').insert({
    ...row,
    user_id: await currentUserId(),
    platform: Platform.OS,
  });
  if (error) throw error;
}

/**
 * Log that someone tapped into a not-yet-built feature. Fire-and-forget: a
 * failed log must never get in the way of the UI, so errors are only warned.
 */
export function logFeatureTap(featureKey: FeatureKey): void {
  insertInterest({ feature_key: featureKey, event_type: 'tap', feedback: null }).catch((error) => {
    console.warn(`Failed to log feature interest tap for ${featureKey}`, error);
  });
}

/** Submit free-text feedback about a not-yet-built feature. Throws on failure. */
export async function submitFeatureFeedback(featureKey: FeatureKey, feedback: string): Promise<void> {
  const text = feedback.trim();
  if (!text) throw new Error('Feedback is empty');
  await insertInterest({ feature_key: featureKey, event_type: 'feedback', feedback: text });
}
