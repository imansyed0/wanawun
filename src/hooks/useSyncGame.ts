import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { generateRounds, calculateSyncScore } from '@/src/services/gameService';
import type { SyncGame, SyncRound } from '@/src/types';

type GamePhase = 'waiting' | 'countdown' | 'playing' | 'round_result' | 'finished';

interface SyncGameState {
  game: SyncGame | null;
  phase: GamePhase;
  currentRound: number;
  rounds: SyncRound[];
  myScore: number;
  opponentScore: number;
  streak: number;
  opponentName: string;
  roomCode: string;
  setupError: string;
}

export function useSyncGame(gameId: string, userId: string) {
  const [state, setState] = useState<SyncGameState>({
    game: null,
    phase: 'waiting',
    currentRound: 0,
    rounds: [],
    myScore: 0,
    opponentScore: 0,
    streak: 0,
    opponentName: 'Opponent',
    roomCode: '',
    setupError: '',
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game, subscribe, and poll — wait for userId to be available
  useEffect(() => {
    if (!userId) return;

    loadGame();
    subscribeToGame();

    // Poll every 2s as fallback for unreliable broadcasts
    pollRef.current = setInterval(() => {
      loadGame();
    }, 2000);

    return () => {
      channelRef.current?.unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId, userId]);

  // Stop polling once game is playing or finished
  useEffect(() => {
    if (state.phase === 'playing' || state.phase === 'finished') {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [state.phase]);

  async function loadGame() {
    const { data } = await supabase
      .from('sync_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!data) return;

    const game = data as SyncGame;

    // Load opponent name
    const opponentId = game.player_a === userId ? game.player_b : game.player_a;
    let opponentName = 'Waiting...';
    if (opponentId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', opponentId)
        .single();
      opponentName = profile?.display_name ?? 'Opponent';
    }

    const hasRounds = game.rounds && game.rounds.length > 0;

    setState(prev => {
      // Don't regress from playing/finished states on poll
      if (prev.phase === 'playing' || prev.phase === 'finished' || prev.phase === 'countdown') {
        // But do update rounds if they just appeared
        if (!prev.rounds.length && hasRounds) {
          return {
            ...prev,
            game,
            rounds: game.rounds ?? [],
            opponentName,
            phase: 'countdown',
          };
        }
        return prev;
      }

      let phase: GamePhase = 'waiting';
      if (game.status === 'active') {
        phase = hasRounds ? 'countdown' : 'waiting';
      }

      return {
        ...prev,
        game,
        roomCode: game.room_code ?? '',
        opponentName,
        phase,
        rounds: game.rounds ?? [],
        myScore: game.scores?.[userId] ?? 0,
        opponentScore: opponentId ? (game.scores?.[opponentId] ?? 0) : 0,
      };
    });

    // If game is active and rounds aren't generated, generate them
    if (game.status === 'active' && !hasRounds) {
      if (game.player_a === userId) {
        try {
          const rounds = await generateRounds(gameId);
          broadcastEvent('rounds_ready', { rounds });
          setState(prev => ({
            ...prev,
            rounds,
            phase: 'countdown',
            setupError: '',
          }));
        } catch (err) {
          console.error('Failed to generate rounds:', err);
          const message = err instanceof Error ? err.message : 'Failed to prepare this duel.';
          setState(prev => ({
            ...prev,
            setupError: message,
          }));
        }
      }
    }
  }

  function subscribeToGame() {
    const channel = supabase.channel(`game:${gameId}`);

    channel
      .on('broadcast', { event: 'player_joined' }, () => {
        loadGame();
      })
      .on('broadcast', { event: 'rounds_ready' }, ({ payload }) => {
        setState(prev => ({
          ...prev,
          rounds: payload.rounds,
          phase: 'countdown',
        }));
      })
      .on('broadcast', { event: 'start_round' }, ({ payload }) => {
        setState(prev => ({
          ...prev,
          currentRound: payload.round_number,
          phase: 'playing',
        }));
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        if (payload.player_id !== userId) {
          setState(prev => ({
            ...prev,
            opponentScore: prev.opponentScore + payload.points,
          }));
        }
      })
      .on('broadcast', { event: 'game_over' }, () => {
        setState(prev => ({
          ...prev,
          phase: 'finished',
        }));
      })
      .subscribe();

    channelRef.current = channel;
  }

  function broadcastEvent(event: string, payload: any) {
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  const submitAnswer = useCallback(
    (answer: string, timeMs: number) => {
      const round = state.rounds[state.currentRound - 1];
      if (!round) return;

      const isCorrect = answer === round.correct_answer;
      const points = calculateSyncScore(isCorrect, timeMs, state.streak);

      broadcastEvent('answer', {
        player_id: userId,
        round_number: state.currentRound,
        answer,
        time_ms: timeMs,
        is_correct: isCorrect,
        points,
      });

      setState(prev => ({
        ...prev,
        myScore: prev.myScore + points,
        streak: isCorrect ? prev.streak + 1 : 0,
      }));

      // After a delay, move to next round or finish
      setTimeout(() => {
        const isLastRound = state.currentRound >= state.rounds.length;
        if (isLastRound) {
          broadcastEvent('game_over', {});
          setState(prev => ({ ...prev, phase: 'finished' }));
        } else {
          const nextRound = state.currentRound + 1;
          broadcastEvent('start_round', { round_number: nextRound });
          setState(prev => ({
            ...prev,
            currentRound: nextRound,
            phase: 'playing',
          }));
        }
      }, 2000);
    },
    [state.currentRound, state.rounds, state.streak, userId]
  );

  const startGame = useCallback(() => {
    broadcastEvent('start_round', { round_number: 1 });
    setState(prev => ({ ...prev, currentRound: 1, phase: 'playing' }));
  }, []);

  return {
    ...state,
    submitAnswer,
    startGame,
  };
}
