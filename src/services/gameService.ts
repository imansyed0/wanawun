import { supabase } from '@/src/lib/supabase';
import { SYNC_GAME } from '@/src/constants/gameConfig';
import type { SyncGame, SyncRound, AsyncGame, WordEntry } from '@/src/types';
import { generateMultipleChoiceOptions, getRandomWords } from './wordService';

// Generate a 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============ SYNC GAME (Koshur Duel) ============

export async function createSyncGame(playerId: string): Promise<SyncGame> {
  const roomCode = generateRoomCode();
  const { data, error } = await supabase
    .from('sync_games')
    .insert({
      player_a: playerId,
      status: 'waiting',
      room_code: roomCode,
      config: { round_count: SYNC_GAME.ROUNDS_PER_GAME },
      scores: { [playerId]: 0 },
    })
    .select()
    .single();

  if (error) throw error;
  return data as SyncGame;
}

export async function joinSyncGame(gameId: string, playerId: string): Promise<SyncGame> {
  const { data: game } = await supabase
    .from('sync_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) throw new Error('Game not found');
  if (game.status !== 'waiting') throw new Error('Game already started');
  if (game.player_a === playerId) throw new Error('Cannot join your own game');

  const { data, error } = await supabase
    .from('sync_games')
    .update({
      player_b: playerId,
      status: 'active',
      scores: { ...game.scores, [playerId]: 0 },
    })
    .eq('id', gameId)
    .select()
    .single();

  if (error) throw error;

  // Get joiner's display name and broadcast to the waiting player
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', playerId)
    .single();

  const channel = supabase.channel(`game:${gameId}`);
  await channel.subscribe();
  await channel.send({
    type: 'broadcast',
    event: 'player_joined',
    payload: { player_id: playerId, display_name: profile?.display_name ?? 'Opponent' },
  });
  channel.unsubscribe();

  return data as SyncGame;
}

export async function joinSyncGameByCode(roomCode: string, playerId: string): Promise<SyncGame> {
  const { data: game } = await supabase
    .from('sync_games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .eq('status', 'waiting')
    .single();

  if (!game) throw new Error('Game not found or already started');
  return joinSyncGame(game.id, playerId);
}

let _generatingRounds = new Set<string>();

async function getDuelWordPool(gameId: string): Promise<WordEntry[]> {
  const { data, error } = await supabase.rpc('get_sync_game_duel_words', {
    game_id_input: gameId,
  });

  if (error) throw error;
  return (data ?? []) as WordEntry[];
}

export async function generateRounds(gameId: string): Promise<SyncRound[]> {
  // Prevent concurrent generation for the same game
  if (_generatingRounds.has(gameId)) {
    throw new Error('Already generating rounds');
  }
  _generatingRounds.add(gameId);

  try {
    const allWords = await getDuelWordPool(gameId);
    if (allWords.length < 2) {
      throw new Error('Both players need to add some lesson vocabulary before starting a duel.');
    }

    const gameWords = getRandomWords(
      allWords,
      Math.min(SYNC_GAME.ROUNDS_PER_GAME, allWords.length)
    );

    const rounds: SyncRound[] = gameWords.map((word, i) => ({
      round_number: i + 1,
      word_id: word.id,
      kashmiri: word.kashmiri,
      correct_answer: word.english,
      options: generateMultipleChoiceOptions(word, allWords, SYNC_GAME.OPTIONS_PER_ROUND),
    }));

    const { error } = await supabase
      .from('sync_games')
      .update({ rounds })
      .eq('id', gameId);

    if (error) {
      console.error('Failed to save rounds:', error);
      throw error;
    }

    console.log('Rounds generated and saved:', rounds.length);
    return rounds;
  } finally {
    _generatingRounds.delete(gameId);
  }
}

export function calculateSyncScore(
  isCorrect: boolean,
  timeMs: number,
  streak: number
): number {
  if (!isCorrect) return SYNC_GAME.POINTS_WRONG_PENALTY;

  let points = SYNC_GAME.POINTS_CORRECT;

  // Speed bonus: linear scale from max bonus at 0ms to 0 at TIME_PER_ROUND_MS
  const speedFraction = Math.max(0, 1 - timeMs / SYNC_GAME.TIME_PER_ROUND_MS);
  points += Math.round(SYNC_GAME.POINTS_SPEED_BONUS_MAX * speedFraction);

  // Streak multiplier
  if (streak >= SYNC_GAME.STREAK_MULTIPLIER_THRESHOLD) {
    points = Math.round(points * SYNC_GAME.STREAK_MULTIPLIER);
  }

  return points;
}

export async function getOpenGames(): Promise<SyncGame[]> {
  const { data, error } = await supabase
    .from('sync_games')
    .select('*, profiles!sync_games_player_a_fkey(display_name)')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data as SyncGame[];
}

// ============ ASYNC GAME (Koshur Messenger) ============

export async function createAsyncGame(
  playerAId: string,
  playerBId: string
): Promise<AsyncGame> {
  const { data, error } = await supabase
    .from('async_games')
    .insert({
      player_a: playerAId,
      player_b: playerBId,
      current_turn: playerAId,
      scores: { [playerAId]: 0, [playerBId]: 0 },
    })
    .select()
    .single();

  if (error) throw error;
  return data as AsyncGame;
}

export async function getMyAsyncGames(playerId: string): Promise<AsyncGame[]> {
  const { data, error } = await supabase
    .from('async_games')
    .select('*')
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as AsyncGame[];
}

export async function submitMessengerTurn(
  gameId: string,
  turn: {
    sender_id: string;
    template_id: string;
    filled_sentence: string;
    filled_words: { position: number; word_id: string; kashmiri: string; english: string }[];
    trap_position: number;
    trap_word: { word_id: string; kashmiri: string; english: string };
    correct_word: { word_id: string; kashmiri: string; english: string };
  }
): Promise<void> {
  const { data: game } = await supabase
    .from('async_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) throw new Error('Game not found');

  const turns = [...(game.turns || []), { ...turn, turn_number: (game.turns?.length || 0) + 1 }];

  // Switch turns to the other player
  const nextTurn = game.player_a === turn.sender_id ? game.player_b : game.player_a;

  await supabase
    .from('async_games')
    .update({
      turns,
      current_turn: nextTurn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);
}

export async function submitMessengerResponse(
  gameId: string,
  turnNumber: number,
  response: {
    responder_translation: string;
    responder_trap_guess: number;
    responder_correct_word?: string;
  }
): Promise<number> {
  const { data: game } = await supabase
    .from('async_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) throw new Error('Game not found');

  const turns = [...game.turns];
  const turn = turns[turnNumber - 1];
  if (!turn) throw new Error('Turn not found');

  let pointsEarned = 0;

  // Award points for spotting the trap
  if (response.responder_trap_guess === turn.trap_position) {
    pointsEarned += 150; // POINTS_SPOT_TRAP
  }

  // Award points for correct translation (simplified: any non-empty translation gets base points)
  if (response.responder_translation && response.responder_translation.trim().length > 0) {
    pointsEarned += 100; // POINTS_CORRECT_TRANSLATION
  }

  // Award bonus for providing correct word
  if (response.responder_correct_word === turn.correct_word.english) {
    pointsEarned += 50; // POINTS_CORRECT_WORD
  }

  turns[turnNumber - 1] = {
    ...turn,
    ...response,
    points_earned: pointsEarned,
  };

  // Update scores
  const responderId = turn.sender_id === game.player_a ? game.player_b : game.player_a;
  const scores = { ...game.scores };
  scores[responderId] = (scores[responderId] || 0) + pointsEarned;

  // Check if game is complete (all rounds played)
  const isComplete = turns.length >= 5 * 2; // 5 rounds * 2 (send + respond)

  await supabase
    .from('async_games')
    .update({
      turns,
      scores,
      status: isComplete ? 'completed' : 'active',
      winner: isComplete
        ? Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  return pointsEarned;
}
