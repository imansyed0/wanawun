import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { addGlossaryWord, invalidateWordCache } from '@/src/services/wordService';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '@/src/constants/theme';
import type { SyncRound } from '@/src/types';

interface GlossaryPromptModalProps {
  visible: boolean;
  userId: string | null | undefined;
  opponentName: string;
  rounds: SyncRound[];
  opponentCorrectRounds: number[];
  onClose: () => void;
}

type Status = 'idle' | 'saving' | 'done' | 'error';

export function GlossaryPromptModal({
  visible,
  userId,
  opponentName,
  rounds,
  opponentCorrectRounds,
  onClose,
}: GlossaryPromptModalProps) {
  const vocab = useMemo(() => {
    const correctSet = new Set(opponentCorrectRounds);
    return rounds.filter((r) => correctSet.has(r.round_number));
  }, [rounds, opponentCorrectRounds]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(vocab.map((r) => [r.word_id, true]))
  );
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [addedCount, setAddedCount] = useState(0);

  const vocabKey = vocab.map((r) => r.word_id).join('|');
  useEffect(() => {
    setSelected(Object.fromEntries(vocab.map((r) => [r.word_id, true])));
    setStatus('idle');
    setMessage('');
    setAddedCount(0);
  }, [vocabKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (wordId: string) => {
    setSelected((prev) => ({ ...prev, [wordId]: !prev[wordId] }));
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const canSubmit = !!userId && selectedCount > 0 && status !== 'saving';

  const handleAdd = async () => {
    if (!userId) {
      setStatus('error');
      setMessage('Sign in to save words to your glossary.');
      return;
    }

    const chosen = vocab.filter((r) => selected[r.word_id]);
    if (chosen.length === 0) return;

    setStatus('saving');
    setMessage('');

    let added = 0;
    let failed = 0;
    for (const round of chosen) {
      try {
        await addGlossaryWord(userId, round.kashmiri, round.correct_answer);
        added += 1;
      } catch (err) {
        console.error('Failed to add word to glossary:', err);
        failed += 1;
      }
    }

    if (added > 0) {
      invalidateWordCache();
    }

    setAddedCount(added);
    if (failed === 0) {
      setStatus('done');
      setMessage(`Added ${added} ${added === 1 ? 'word' : 'words'} to your glossary.`);
    } else if (added === 0) {
      setStatus('error');
      setMessage('Could not save these words. Please try again.');
    } else {
      setStatus('done');
      setMessage(`Added ${added}, but ${failed} could not be saved.`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.wrap}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Save {opponentName}&apos;s vocab?</Text>
              <Pressable
                style={styles.closeBtn}
                onPress={onClose}
                disabled={status === 'saving'}
              >
                <Text style={styles.closeText}>{'×'}</Text>
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              These are the words {opponentName} got right. Pick the ones you
              want to add to your glossary.
            </Text>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {vocab.map((round) => {
                const checked = !!selected[round.word_id];
                return (
                  <Pressable
                    key={`${round.round_number}-${round.word_id}`}
                    style={[styles.row, checked && styles.rowChecked]}
                    onPress={() => toggle(round.word_id)}
                    disabled={status === 'saving' || status === 'done'}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? <Text style={styles.checkmark}>{'✓'}</Text> : null}
                    </View>
                    <View style={styles.wordMain}>
                      <Text style={styles.kashmiri}>{round.kashmiri}</Text>
                      <Text style={styles.english}>{round.correct_answer}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {message ? (
              <Text
                style={[
                  styles.message,
                  status === 'error' && styles.messageError,
                  status === 'done' && styles.messageSuccess,
                ]}
              >
                {message}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {status === 'done' ? (
                <Button title="Done" onPress={onClose} />
              ) : (
                <>
                  <Button
                    title="Not now"
                    variant="ghost"
                    onPress={onClose}
                    disabled={status === 'saving'}
                  />
                  <Button
                    title={
                      status === 'saving'
                        ? 'Adding...'
                        : selectedCount > 0
                          ? `Add ${selectedCount} to glossary`
                          : 'Add to glossary'
                    }
                    onPress={handleAdd}
                    disabled={!canSubmit}
                  />
                </>
              )}
            </View>
            {status === 'saving' && addedCount === 0 ? (
              <ActivityIndicator
                style={styles.spinner}
                size="small"
                color={Colors.primary}
              />
            ) : null}
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 20, 24, 0.45)',
  },
  wrap: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: 22,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowChecked: {
    borderColor: Colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 14,
    fontFamily: FontFamily.bodyBold,
  },
  wordMain: {
    flex: 1,
  },
  kashmiri: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.heading,
    color: Colors.accent,
  },
  english: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  messageError: {
    color: Colors.wrong,
  },
  messageSuccess: {
    color: Colors.correct,
  },
  actions: {
    gap: Spacing.sm,
  },
  spinner: {
    marginTop: Spacing.xs,
  },
});
