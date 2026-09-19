-- Beta-test feedback. TEMPORARY: drop this table when the beta ends.
--
-- Free text from the in-app beta feedback button, with just enough context to
-- place a report against a build. iOS testers send theirs through TestFlight's
-- own screenshot feedback instead, so rows from iOS are not expected here.
--
-- Write-only from the app, like feature_interest (010). There is deliberately no
-- select/update/delete policy: a tester can send feedback but can't read anyone
-- else's back. Read the table from the Supabase dashboard or the service role.
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback text not null check (char_length(btrim(feedback)) > 0 and char_length(feedback) <= 2000),
  -- Null for signed-out users; the app lets people learn without an account.
  user_id uuid references public.profiles(id) on delete set null,
  platform text check (platform is null or char_length(platform) <= 16),
  -- Null when the app can't read its own version (e.g. a bare web build).
  app_version text check (app_version is null or char_length(app_version) <= 32),
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

create policy "Anyone can send anonymous beta feedback" on public.beta_feedback
  for insert to anon
  with check (user_id is null);

create policy "Users can send own beta feedback" on public.beta_feedback
  for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

create index idx_beta_feedback_created on public.beta_feedback(created_at desc);
