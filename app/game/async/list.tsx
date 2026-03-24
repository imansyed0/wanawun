import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { getMyAsyncGames } from '@/src/services/gameService';
import type { AsyncGame } from '@/src/types';
import { supabase } from '@/src/lib/supabase';

export default function AsyncGameListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [games, setGames] = useState<AsyncGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) loadGames();
  }, [user]);

  async function loadGames() {
    setLoading(true);
    try {
      const data = await getMyAsyncGames(user!.id);
      setGames(data);

      // Load opponent names
      const opponentIds = data.map(g =>
        g.player_a === user!.id ? g.player_b : g.player_a
      );
      const uniqueIds = [...new Set(opponentIds)];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', uniqueIds);

      const names: Record<string, string> = {};
      profiles?.forEach(p => { names[p.id] = p.display_name; });
      setOpponentNames(names);
    } catch {}
    setLoading(false);
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Sign in to play Koshur Messenger</Text>
          <Button title="Sign In" onPress={() => router.push('/auth/login')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Button
        title="New Game"
        onPress={() => router.push('/game/async/new')}
        style={styles.newGameBtn}
      />

      <FlatList
        data={games}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadGames}
        renderItem={({ item }) => {
          const opponentId = item.player_a === user.id ? item.player_b : item.player_a;
          const isMyTurn = item.current_turn === user.id;
          const myScore = item.scores?.[user.id] ?? 0;
          const theirScore = item.scores?.[opponentId] ?? 0;

          return (
            <Card
              style={isMyTurn ? [styles.gameCard, styles.myTurnCard] : styles.gameCard}
            >
              <View style={styles.gameRow}>
                <View>
                  <Text style={styles.opponentName}>
                    vs {opponentNames[opponentId] ?? 'Player'}
                  </Text>
                  <Text style={styles.turnText}>
                    {isMyTurn ? 'Your turn!' : 'Waiting for them...'}
                  </Text>
                  <Text style={styles.scoreText}>
                    {myScore} - {theirScore}
                  </Text>
                </View>
                <Button
                  title={isMyTurn ? 'Play' : 'View'}
                  size="sm"
                  variant={isMyTurn ? 'primary' : 'outline'}
                  onPress={() => router.push(`/game/async/${item.id}`)}
                />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading...' : 'No active games. Start one!'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  newGameBtn: {
    marginBottom: Spacing.lg,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  gameCard: {
    padding: Spacing.md,
  },
  myTurnCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opponentName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  turnText: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textLight,
    marginTop: Spacing.xl,
  },
});
