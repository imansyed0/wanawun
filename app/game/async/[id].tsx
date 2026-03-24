import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ScoreBar } from '@/src/components/ui/ScoreBar';
import { SentenceBuilder } from '@/src/components/game/SentenceBuilder';
import { TrapSpotter } from '@/src/components/game/TrapSpotter';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { submitMessengerTurn, submitMessengerResponse } from '@/src/services/gameService';
import { getAllWords, getWordsBySlotType, getRandomWords } from '@/src/services/wordService';
import type { AsyncGame, MessengerTurn, SentenceTemplate, WordEntry } from '@/src/types';

export default function AsyncGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<AsyncGame | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [template, setTemplate] = useState<SentenceTemplate | null>(null);
  const [wordOptions, setWordOptions] = useState<{ [position: number]: WordEntry[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadGame();
  }, [id, user?.id]);

  async function loadGame() {
    setLoading(true);
    setError('');
    setSentSuccess(false);
    try {
      const { data, error: fetchErr } = await supabase
        .from('async_games')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !data) {
        console.error('Failed to load async game:', fetchErr);
        setError('Game not found');
        setLoading(false);
        return;
      }

      const gameData = data as AsyncGame;
      setGame(gameData);

      // Load opponent name
      const opponentId = gameData.player_a === user?.id ? gameData.player_b : gameData.player_a;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', opponentId)
        .single();
      setOpponentName(profile?.display_name ?? 'Opponent');

      // If it's my turn to send, load a template and word options
      if (gameData.current_turn === user?.id && needsToSend(gameData)) {
        await loadTemplateAndWords();
      }
    } catch (err: any) {
      console.error('loadGame error:', err);
      setError(err.message || 'Failed to load game');
    }
    setLoading(false);
  }

  function needsToSend(g: AsyncGame): boolean {
    const turns = g.turns ?? [];
    // If last turn has no response yet, it's the responder's turn
    if (turns.length > 0) {
      const lastTurn = turns[turns.length - 1];
      if (!lastTurn.responder_translation) return false; // waiting for response
    }
    return true; // needs to send a new sentence
  }

  function needsToRespond(g: AsyncGame): boolean {
    const turns = g.turns ?? [];
    if (turns.length === 0) return false;
    const lastTurn = turns[turns.length - 1];
    return !lastTurn.responder_translation && lastTurn.sender_id !== user?.id;
  }

  async function loadTemplateAndWords() {
    // Load a random template
    const { data: templates, error: tmplErr } = await supabase
      .from('sentence_templates')
      .select('*')
      .limit(10);

    if (tmplErr) {
      console.error('Failed to load templates:', tmplErr);
      setError('Failed to load sentence templates');
      return;
    }

    if (templates && templates.length > 0) {
      const tmpl = templates[Math.floor(Math.random() * templates.length)] as SentenceTemplate;
      setTemplate(tmpl);

      // Load word options for each slot
      const allWords = await getAllWords();
      const options: { [position: number]: WordEntry[] } = {};
      for (const slot of tmpl.slots) {
        const slotWords = getWordsBySlotType(allWords, slot.type);
        options[slot.position] = getRandomWords(slotWords, 8);
      }
      setWordOptions(options);
    } else {
      setError('No sentence templates available');
    }
  }

  async function handleSendSentence(
    filledWords: { position: number; word: WordEntry }[],
    trapPosition: number,
    trapWord: WordEntry
  ) {
    if (!game || !user || !template) return;

    const correctWord = filledWords.find(w => w.position === trapPosition)!.word;

    // Build the filled sentence string
    let sentence = template.template;
    filledWords.forEach(fw => {
      sentence = sentence.replace('___', fw.word.kashmiri);
    });
    // Replace the trap position
    const sentenceWords = sentence.split(' ');
    // Simple approach: replace the correct word with trap
    sentence = sentence.replace(correctWord.kashmiri, trapWord.kashmiri);

    try {
      await submitMessengerTurn(game.id, {
        sender_id: user.id,
        template_id: template.id,
        filled_sentence: sentence,
        filled_words: filledWords.map(fw => ({
          position: fw.position,
          word_id: fw.word.id,
          kashmiri: fw.position === trapPosition ? trapWord.kashmiri : fw.word.kashmiri,
          english: fw.position === trapPosition ? trapWord.english : fw.word.english,
        })),
        trap_position: trapPosition,
        trap_word: { word_id: trapWord.id, kashmiri: trapWord.kashmiri, english: trapWord.english },
        correct_word: { word_id: correctWord.id, kashmiri: correctWord.kashmiri, english: correctWord.english },
      });

      setSentSuccess(true);
      await loadGame();
    } catch (err: any) {
      console.error('Failed to send sentence:', err);
      setError(err.message || 'Failed to send sentence');
    }
  }

  async function handleRespond(trapGuess: number, translation: string, correctWordGuess?: string) {
    if (!game || !user) return;
    const turns = game.turns ?? [];
    const lastTurn = turns[turns.length - 1];

    try {
      await submitMessengerResponse(game.id, lastTurn.turn_number, {
        responder_translation: translation,
        responder_trap_guess: trapGuess,
        responder_correct_word: correctWordGuess,
      });
      await loadGame();
    } catch (err: any) {
      console.error('Failed to submit response:', err);
      setError(err.message || 'Failed to submit response');
    }
  }

  if (loading || !game || !user) {
    return (
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Go Back" onPress={() => router.back()} />
          </View>
        ) : (
          <Text style={styles.loadingText}>Loading...</Text>
        )}
      </SafeAreaView>
    );
  }

  const isMyTurn = game.current_turn === user.id;
  const myScore = game.scores?.[user.id] ?? 0;
  const opponentId = game.player_a === user.id ? game.player_b : game.player_a;
  const theirScore = game.scores?.[opponentId] ?? 0;
  const turns = game.turns ?? [];

  // Game complete
  if (game.status === 'completed') {
    const won = myScore > theirScore;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultsContainer}>
          <Text style={[styles.resultTitle, won ? styles.resultWin : styles.resultLose]}>
            {myScore === theirScore ? 'Draw!' : won ? 'You Win!' : 'You Lose'}
          </Text>
          <ScoreBar
            playerAName="You"
            playerBName={opponentName}
            playerAScore={myScore}
            playerBScore={theirScore}
          />
          <Button title="Back to Games" onPress={() => router.push('/game/async/list')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScoreBar
          playerAName="You"
          playerBName={opponentName}
          playerAScore={myScore}
          playerBScore={theirScore}
          currentRound={Math.ceil((turns.length + 1) / 2)}
          totalRounds={5}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {sentSuccess ? (
          <Card style={styles.waitingCard}>
            <Text style={styles.waitingText}>Sentence sent!</Text>
            <Text style={styles.waitingSubtext}>
              Waiting for {opponentName} to respond...
            </Text>
          </Card>
        ) : null}

        {/* My turn to send a sentence */}
        {!sentSuccess && isMyTurn && needsToSend(game) && template && (
          <SentenceBuilder
            template={template}
            wordOptions={wordOptions}
            onComplete={handleSendSentence}
          />
        )}

        {/* My turn to respond to a sentence */}
        {isMyTurn && needsToRespond(game) && turns.length > 0 && (
          <TrapSpotter
            turn={turns[turns.length - 1] as MessengerTurn}
            onSubmit={handleRespond}
          />
        )}

        {/* Waiting for opponent */}
        {!sentSuccess && !isMyTurn && (
          <Card style={styles.waitingCard}>
            <Text style={styles.waitingText}>
              Waiting for {opponentName} to play...
            </Text>
            <Text style={styles.waitingSubtext}>
              Check back later for your turn
            </Text>
          </Card>
        )}

        {/* Turn history */}
        {turns.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Turn History</Text>
            {turns.filter((t: MessengerTurn) => t.responder_translation).map((t: MessengerTurn, i: number) => (
              <Card key={i} style={styles.historyCard}>
                <Text style={styles.historyRound}>Round {Math.ceil((i + 1) / 2)}</Text>
                <Text style={styles.historySentence}>{t.filled_sentence}</Text>
                <Text style={styles.historyPoints}>+{t.points_earned ?? 0} pts</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: Spacing.xxl,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  errorText: {
    color: Colors.wrong,
    fontSize: FontSize.sm,
    textAlign: 'center',
    backgroundColor: '#fef2f2',
    padding: Spacing.md,
    borderRadius: 8,
    overflow: 'hidden',
  },
  waitingCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  waitingText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  waitingSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  historySection: {
    gap: Spacing.sm,
  },
  historyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  historyCard: {
    padding: Spacing.md,
    gap: 4,
  },
  historyRound: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
  },
  historySentence: {
    fontSize: FontSize.md,
    color: Colors.accent,
    fontWeight: '600',
  },
  historyPoints: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  resultsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  resultTitle: {
    fontSize: FontSize.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultWin: { color: Colors.correct },
  resultLose: { color: Colors.wrong },
});
