import { supabase } from '@/src/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Permanently deletes the signed-in user's account.
 *
 * The actual deletion happens in the `delete-account` edge function, which
 * needs the service role key. The user row cascades to their profile and from
 * there to every other table, so there is nothing to clean up client-side
 * beyond the local session.
 *
 * Throws with a user-presentable message on failure.
 */
export async function deleteAccount(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You are not signed in.');
  }

  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }
}

/**
 * supabase-js surfaces a non-2xx edge function response as an opaque
 * FunctionsHttpError; the body carrying our actual message has to be read off
 * the underlying Response.
 */
async function readFunctionError(error: unknown): Promise<string> {
  const fallback = 'Could not delete your account. Please try again.';

  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Body was not JSON — fall through to the generic message.
    }
  }

  return fallback;
}
