create or replace function public.get_sync_game_duel_words(game_id_input uuid)
returns table (
  id text,
  kashmiri text,
  english text,
  part_of_speech text,
  category text,
  difficulty smallint,
  is_loan_word boolean,
  is_phrase boolean,
  audio_url text
)
language sql
security definer
set search_path = public
as $$
  with allowed_game as (
    select player_a, player_b
    from public.sync_games
    where id = game_id_input
      and auth.uid() in (player_a, player_b)
  ),
  ranked_words as (
    select
      coalesce(lv.word_id::text, 'lesson-vocab:' || lv.id::text) as id,
      lv.kashmiri,
      lv.english,
      coalesce(w.part_of_speech, 'other') as part_of_speech,
      coalesce(w.category, 'lesson') as category,
      coalesce(w.difficulty, 1)::smallint as difficulty,
      coalesce(w.is_loan_word, false) as is_loan_word,
      coalesce(w.is_phrase, position(' ' in trim(lv.kashmiri)) > 0) as is_phrase,
      w.audio_url,
      row_number() over (
        partition by lower(trim(lv.kashmiri)), lower(trim(lv.english))
        order by
          case when w.audio_url is not null then 0 else 1 end,
          lv.created_at asc
      ) as row_rank
    from public.lesson_vocab lv
    join allowed_game g
      on lv.user_id in (g.player_a, g.player_b)
    left join public.words w
      on w.id = lv.word_id
  )
  select
    id,
    kashmiri,
    english,
    part_of_speech,
    category,
    difficulty,
    is_loan_word,
    is_phrase,
    audio_url
  from ranked_words
  where row_rank = 1
  order by kashmiri;
$$;

grant execute on function public.get_sync_game_duel_words(uuid) to authenticated;
