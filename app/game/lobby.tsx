import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { createSyncGame, getOpenGames, joinSyncGame, joinSyncGameByCode } from '@/src/services/gameService';
import type { SyncGame } from '@/src/types';

export default function LobbyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [openGames, setOpenGames] = useState<SyncGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    try {
      const games = await getOpenGames();
      setOpenGames(games);
    } catch {}
  }

  async function handleCreateGame() {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const game = await createSyncGame(user.id);
      router.push(`/game/sync/${game.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinByCode() {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!roomCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const game = await joinSyncGameByCode(roomCode.trim(), user.id);
      router.push(`/game/sync/${game.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame(gameId: string) {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const game = await joinSyncGame(gameId, user.id);
      router.push(`/game/sync/${game.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.createSection}>
        <Text style={styles.sectionTitle}>Create a Game</Text>
        <Text style={styles.sectionDesc}>
          Start a new Koshur Duel and share the room code with a friend
        </Text>
        <Button
          title={loading ? 'Creating...' : 'Create Room'}
          onPress={handleCreateGame}
          disabled={loading}
        />
      </Card>

      <Card style={styles.joinSection}>
        <Text style={styles.sectionTitle}>Join by Code</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="ABCD12"
            placeholderTextColor={Colors.textLight}
            value={roomCode}
            onChangeText={text => setRoomCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
          />
          <Button
            title="Join"
            onPress={handleJoinByCode}
            disabled={loading || roomCode.length < 4}
          />
        </View>
      </Card>

      <Text style={styles.orText}>Open Games</Text>

      <FlatList
        data={openGames}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.gameList}
        refreshing={loading}
        onRefresh={loadGames}
        renderItem={({ item }) => (
          <Card style={styles.gameItem}>
            <View style={styles.gameItemRow}>
              <View>
                <Text style={styles.gameItemCode}>{item.room_code}</Text>
                <Text style={styles.gameItemPlayer}>
                  Waiting for opponent...
                </Text>
              </View>
              <Button
                title="Join"
                size="sm"
                onPress={() => handleJoinGame(item.id)}
              />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No open games. Create one!</Text>
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
  createSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  joinSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  codeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  orText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  gameList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  gameItem: {
    padding: Spacing.md,
  },
  gameItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameItemCode: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  gameItemPlayer: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textLight,
    marginTop: Spacing.lg,
  },
  error: {
    color: Colors.wrong,
    fontSize: FontSize.sm,
    textAlign: 'center',
    padding: Spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
});
