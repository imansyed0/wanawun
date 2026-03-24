-- Vocabulary entries added by users while listening to lessons
-- Each entry links to the main words table for glossary integration
create table public.lesson_vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null,          -- e.g. "spoken-ch1", "ciil-prog3"
  course_id text not null,          -- e.g. "spoken-kashmiri", "ciil"
  kashmiri text not null,
  english text not null,
  word_id uuid references public.words(id), -- linked glossary entry
  created_at timestamptz not null default now()
);

alter table public.lesson_vocab enable row level security;

create policy "Users can view own lesson vocab" on public.lesson_vocab
  for select using (auth.uid() = user_id);
create policy "Users can insert own lesson vocab" on public.lesson_vocab
  for insert with check (auth.uid() = user_id);
create policy "Users can update own lesson vocab" on public.lesson_vocab
  for update using (auth.uid() = user_id);
create policy "Users can delete own lesson vocab" on public.lesson_vocab
  for delete using (auth.uid() = user_id);

create index idx_lesson_vocab_user_lesson on public.lesson_vocab(user_id, lesson_id);
create index idx_lesson_vocab_course on public.lesson_vocab(user_id, course_id);
