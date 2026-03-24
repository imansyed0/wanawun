-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  elo_rating integer not null default 1000,
  words_learned integer not null default 0,
  games_played integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Words (glossary data)
create table public.words (
  id uuid primary key default gen_random_uuid(),
  kashmiri text not null,
  english text not null,
  part_of_speech text not null,
  gender text,
  number text,
  category text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  is_loan_word boolean not null default false,
  is_phrase boolean not null default false,
  audio_url text -- URL to audio recording/clip for this word
);

alter table public.words enable row level security;
create policy "Words are viewable by everyone" on public.words
  for select using (true);

create index idx_words_category on public.words(category);
create index idx_words_difficulty on public.words(difficulty);
create index idx_words_part_of_speech on public.words(part_of_speech);

-- Sentence templates (for Koshur Messenger async game)
create table public.sentence_templates (
  id uuid primary key default gen_random_uuid(),
  template text not null, -- Kashmiri sentence with ___ blanks
  english_template text not null, -- English translation with [slot_type] markers
  slots jsonb not null, -- array of {position, type, category}
  difficulty smallint not null check (difficulty between 1 and 3)
);

alter table public.sentence_templates enable row level security;
create policy "Templates are viewable by everyone" on public.sentence_templates
  for select using (true);

-- Sync games (Koshur Duel)
create table public.sync_games (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.profiles(id),
  player_b uuid references public.profiles(id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'abandoned')),
  config jsonb not null default '{"round_count": 10}',
  rounds jsonb not null default '[]',
  scores jsonb not null default '{}',
  winner uuid references public.profiles(id),
  room_code text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sync_games enable row level security;
create policy "Players can view their games" on public.sync_games
  for select using (auth.uid() = player_a or auth.uid() = player_b or status = 'waiting');
create policy "Authenticated users can create games" on public.sync_games
  for insert with check (auth.uid() = player_a);
create policy "Players can update their games" on public.sync_games
  for update using (auth.uid() = player_a or auth.uid() = player_b or (status = 'waiting' and player_b is null));

create index idx_sync_games_status on public.sync_games(status);
create index idx_sync_games_room_code on public.sync_games(room_code);

-- Async games (Koshur Messenger)
create table public.async_games (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.profiles(id),
  player_b uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_turn uuid not null,
  turns jsonb not null default '[]',
  scores jsonb not null default '{}',
  winner uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.async_games enable row level security;
create policy "Players can view their async games" on public.async_games
  for select using (auth.uid() = player_a or auth.uid() = player_b);
create policy "Authenticated users can create async games" on public.async_games
  for insert with check (auth.uid() = player_a);
create policy "Players can update their async games" on public.async_games
  for update using (auth.uid() = player_a or auth.uid() = player_b);

-- Player word progress (spaced repetition tracking)
create table public.player_word_progress (
  player_id uuid not null references public.profiles(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  times_seen integer not null default 0,
  times_correct integer not null default 0,
  last_seen timestamptz not null default now(),
  mastery_level smallint not null default 0 check (mastery_level between 0 and 5),
  primary key (player_id, word_id)
);

alter table public.player_word_progress enable row level security;
create policy "Users can view own progress" on public.player_word_progress
  for select using (auth.uid() = player_id);
create policy "Users can upsert own progress" on public.player_word_progress
  for insert with check (auth.uid() = player_id);
create policy "Users can update own progress" on public.player_word_progress
  for update using (auth.uid() = player_id);
