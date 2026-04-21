import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { WordDisplay } from '@/src/components/ui/WordDisplay';
import { Timer } from '@/src/components/ui/Timer';
import { ScoreBar } from '@/src/components/ui/ScoreBar';
import { MultipleChoice } from '@/src/components/game/MultipleChoice';
import { GlossaryPromptModal } from '@/src/components/game/GlossaryPromptModal';
import { useSyncGame } from '@/src/hooks/useSyncGame';
import { useAuth } from '@/src/hooks/useAuth';
import { SYNC_GAME } from '@/src/constants/gameConfig';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';

export default function SyncGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [glossaryPromptVisible, setGlossaryPromptVisible] = useState(false);
  const [glossaryPromptShown, setGlossaryPromptShown] = useState(false);

  const {
    phase,
    currentRound,
    rounds,
    myScore,
    opponentScore,
    opponentName,
    roomCode,
    setupError,
    opponentCorrectRounds,
    submitAnswer,
    startGame,
  } = useSyncGame(id!, user?.id ?? '');

  // When the game ends, prompt (once) to save opponent's vocab.
  useEffect(() => {
    if (
      phase === 'finished' &&
      !glossaryPromptShown &&
      opponentCorrectRounds.length > 0
    ) {
      setGlossaryPromptVisible(true);
      setGlossaryPromptShown(true);
    }
  }, [phase, glossaryPromptShown, opponentCorrectRounds.length]);

  // Countdown timer — only starts when we have rounds
  useEffect(() => {
    if (phase !== 'countdown' || rounds.length === 0) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          startGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, rounds.length, startGame]);

  const currentRoundData = rounds[currentRound - 1];

  // Waiting for opponent
  if (phase === 'waiting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingTitle}>Waiting for opponent...</Text>
          {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}
          <Card style={styles.codeCard}>
            <Text style={styles.codeLabel}>Room Code</Text>
            <Text style={styles.codeValue}>{roomCode}</Text>
          </Card>
          <Button
            title="Share Code"
            variant="outline"
            onPress={() =>
              Share.share({
                message: `Join my Koshur Clash! Room code: ${roomCode}`,
              })
            }
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Countdown
  if (phase === 'countdown') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.countdownContainer}>
          <Text style={styles.vsText}>
            {profile?.display_name ?? 'You'} vs {opponentName}
          </Text>
          <Animated.Text
            key={`countdown-${countdown}`}
            entering={ZoomIn.duration(300)}
            style={styles.countdownNumber}
          >
            {countdown}
          </Animated.Text>
          <Text style={styles.getReady}>Get Ready!</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Game finished
  if (phase === 'finished') {
    const won = myScore > opponentScore;
    const tied = myScore === opponentScore;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultsContainer}>
          <Animated.Text
            entering={ZoomIn.duration(500)}
            style={[styles.resultTitle, won && styles.resultWin]}
          >
            {tied ? 'Draw!' : won ? 'You Win!' : 'You Lose'}
          </Animated.Text>

          <ScoreBar
            playerAName={profile?.display_name ?? 'You'}
            playerBName={opponentName}
            playerAScore={myScore}
            playerBScore={opponentScore}
          />

          <View style={styles.resultButtons}>
            {opponentCorrectRounds.length > 0 && (
              <Button
                title="Save opponent's vocab"
                variant="secondary"
                onPress={() => setGlossaryPromptVisible(true)}
              />
            )}
            <Button title="Play Again" onPress={() => router.push('/game/lobby')} />
            <Button title="Home" variant="outline" onPress={() => router.push('/')} />
          </View>
        </View>

        <GlossaryPromptModal
          visible={glossaryPromptVisible}
          userId={user?.id}
          opponentName={opponentName}
          rounds={rounds}
          opponentCorrectRounds={opponentCorrectRounds}
          onClose={() => setGlossaryPromptVisible(false)}
        />
      </SafeAreaView>
    );
  }

  // Playing a round
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameContainer}>
        <ScoreBar
          playerAName={profile?.display_name ?? 'You'}
          playerBName={opponentName}
          playerAScore={myScore}
          playerBScore={opponentScore}
          currentRound={currentRound}
          totalRounds={rounds.length}
        />

        <Timer
          durationMs={SYNC_GAME.TIME_PER_ROUND_MS}
          onTimeout={() => submitAnswer('', SYNC_GAME.TIME_PER_ROUND_MS)}
          isRunning={phase === 'playing'}
          key={currentRound}
        />

        {currentRoundData && (
          <ScrollView
            style={styles.roundScroll}
            contentContainerStyle={styles.roundContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              key={currentRound}
              entering={FadeIn.duration(400)}
              style={styles.roundInner}
            >
              <WordDisplay kashmiri={currentRoundData.kashmiri} size="lg" />

              <MultipleChoice
                options={currentRoundData.options}
                correctAnswer={currentRoundData.correct_answer}
                onAnswer={submitAnswer}
              />
            </Animated.View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Waiting
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.wrong,
    textAlign: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  codeCard: {
    alignItems: 'center',
    width: '100%',
  },
  codeLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  codeValue: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 8,
    marginTop: Spacing.sm,
  },
  // Countdown
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  vsText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '800',
    color: Colors.primary,
  },
  getReady: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  // Game
  gameContainer: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  roundScroll: {
    flex: 1,
  },
  roundContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.lg,
  },
  roundInner: {
    gap: Spacing.lg,
  },
  // Results
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
    color: Colors.wrong,
  },
  resultWin: {
    color: Colors.correct,
  },
  resultButtons: {
    gap: Spacing.sm,
  },
});
