create table public.lesson_clip_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  clip_filename text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id, clip_filename)
);

alter table public.lesson_clip_progress enable row level security;

create policy "Users can view own clip progress" on public.lesson_clip_progress
  for select using (auth.uid() = user_id);

create policy "Users can insert own clip progress" on public.lesson_clip_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can update own clip progress" on public.lesson_clip_progress
  for update using (auth.uid() = user_id);

create index idx_lesson_clip_progress_user_course_lesson
  on public.lesson_clip_progress(user_id, course_id, lesson_id);

