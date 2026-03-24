-- Allow authenticated users to add and update glossary words.
-- Lesson vocab attempts to sync into the global words table, and audio uploads
-- update the linked word record.
create policy "Authenticated users can insert words" on public.words
  for insert to authenticated
  with check (auth.uid() is not null);

create policy "Authenticated users can update words" on public.words
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
