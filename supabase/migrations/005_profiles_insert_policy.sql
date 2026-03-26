create policy "Users can insert own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);
