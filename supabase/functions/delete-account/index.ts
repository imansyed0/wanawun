// Deletes the calling user's own account.
//
// App Store Review guideline 5.1.1(v) requires any app that supports account
// creation to let users delete that account from inside the app. Removing a
// row from auth.users needs the service role key, which can never ship in the
// client, so the deletion happens here instead.
//
// The only account this function will ever delete is the one identified by the
// caller's own access token — there is no user id in the request body to
// tamper with.
//
// Everything else cascades: public.profiles.id references auth.users on delete
// cascade, and lesson vocab, clip progress, glossary words and games all
// cascade off profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account is missing one of SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY');
    return json({ error: 'Server is misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Not signed in' }, 401);
  }

  // Resolve the caller from their own token. The platform already rejects
  // requests without a syntactically valid JWT, but that check also passes for
  // a bare anon key, so establish which *user* is asking before deleting.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Not signed in' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error(`Failed to delete user ${user.id}`, deleteError);
    return json({ error: 'Could not delete the account' }, 500);
  }

  console.log(`Deleted user ${user.id}`);
  return json({ success: true }, 200);
});
