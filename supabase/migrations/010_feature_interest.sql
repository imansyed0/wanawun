-- Fake-door interest tracking (WAN-48).
--
-- Records interest in features that aren't built yet: every time someone taps
-- the entry point ('tap') and every piece of free-text feedback they send about
-- how it should work ('feedback'). The first feature using it is Koshur Clash.
--
-- Write-only from the app. There is deliberately no select/update/delete policy:
-- clients can log events but can't read anyone's feedback back. Read the table
-- from the Supabase dashboard or with the service role.
create table public.feature_interest (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null check (char_length(feature_key) between 1 and 64),
  event_type text not null check (event_type in ('tap', 'feedback')),
  -- Null for signed-out users; the app lets people learn without an account.
  user_id uuid references public.profiles(id) on delete set null,
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  platform text check (platform is null or char_length(platform) <= 16),
  created_at timestamptz not null default now(),
  -- Feedback rows must carry text; tap rows must not.
  check (
    (event_type = 'feedback' and feedback is not null and char_length(btrim(feedback)) > 0)
    or (event_type = 'tap' and feedback is null)
  )
);

alter table public.feature_interest enable row level security;

create policy "Anyone can log anonymous feature interest" on public.feature_interest
  for insert to anon
  with check (user_id is null);

create policy "Users can log own feature interest" on public.feature_interest
  for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

create index idx_feature_interest_feature_created
  on public.feature_interest(feature_key, created_at desc);
