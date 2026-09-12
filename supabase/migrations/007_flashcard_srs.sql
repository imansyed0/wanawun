-- Per-user spaced repetition state for flashcards (Anki-style SM-2).
--
-- One row per *card*, not per word: each glossary word produces two cards,
-- Kashmiri->English and English->Kashmiri, so each direction is scheduled
-- independently.
--
-- card_key is content-derived ("<kashmiri>::<english>::<direction>", lowercased)
-- rather than a foreign key, so review history survives a word being re-added,
-- de-duplicated, or synced up from a signed-out session.
create table public.flashcard_srs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_key text not null,
  word_id uuid references public.words(id) on delete set null,
  direction text not null check (direction in ('k2e', 'e2k')),
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  ease real not null default 2.5,
  interval_days real not null default 0,
  step_index integer not null default 0,
  due_at timestamptz not null default now(),
  reps integer not null default 0,
  lapses integer not null default 0,
  introduced_at timestamptz,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, card_key)
);

alter table public.flashcard_srs enable row level security;

create policy "Users can view own flashcard srs" on public.flashcard_srs
  for select using (auth.uid() = user_id);

create policy "Users can insert own flashcard srs" on public.flashcard_srs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own flashcard srs" on public.flashcard_srs
  for update using (auth.uid() = user_id);

create policy "Users can delete own flashcard srs" on public.flashcard_srs
  for delete using (auth.uid() = user_id);

-- The review queue is always "my cards, ordered by when they come due".
create index idx_flashcard_srs_user_due on public.flashcard_srs(user_id, due_at);
