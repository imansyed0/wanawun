import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { WordSheet } from '@/src/components/ui/WordSheet';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  LineHeight,
  Spacing,
} from '@/src/constants/theme';
import type { WordEntry } from '@/src/types';

interface WordActionsSheetProps {
  /** The word whose options are open, or null when the sheet is closed. */
  word: WordEntry | null;
  /** Offer re-record: the word already has audio and the user can upload their own. */
  canReRecord: boolean;
  /** Offer delete: signed-in words, plus pending words that only live on this device. */
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onReRecord: () => void;
  onDelete: () => void;
}

/**
 * Options for one glossary word. Re-recording and deleting used to sit on every
 * row, which made a wall of buttons and put delete a single tap away; they live
 * behind a tap on the word now. Playing and first-time recording stay inline.
 */
export function WordActionsSheet({
  word,
  canReRecord,
  canDelete,
  deleting,
  onClose,
  onReRecord,
  onDelete,
}: WordActionsSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Each word opens on its own options, never on the previous word's confirm step.
  useEffect(() => {
    setConfirmingDelete(false);
  }, [word?.id]);

  if (!word) return null;

  return (
    <WordSheet visible onClose={onClose} closeLabel={`Close options for ${word.kashmiri}`}>
      <View style={styles.heading}>
        <Text style={styles.kashmiri}>{word.kashmiri}</Text>
        <Text style={styles.english}>{word.english}</Text>
      </View>

      {confirmingDelete ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>Delete this word?</Text>
          <Text style={styles.confirmBody}>
            It comes out of your glossary, along with any recording you made of it.
            This can&rsquo;t be undone.
          </Text>
          {deleting ? (
            <ActivityIndicator color={Colors.wrong} style={styles.confirmSpinner} />
          ) : (
            <View style={styles.confirmActions}>
              <Button title="Delete" onPress={onDelete} variant="danger" />
              <Button title="Keep it" onPress={() => setConfirmingDelete(false)} variant="ghost" />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.actions}>
          {canReRecord ? (
            <Pressable
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              onPress={onReRecord}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>Record again</Text>
              <Text style={styles.actionHint}>Replaces the recording you have</Text>
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, styles.actionTextDanger]}>Delete word</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </WordSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: Spacing.md,
  },
  kashmiri: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.kashmiri(FontSize.xl),
    fontFamily: FontFamily.kashmiri,
    color: Colors.accent,
  },
  english: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    color: Colors.textSecondary,
  },
  actions: {
    gap: Spacing.sm,
  },
  action: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionPressed: {
    backgroundColor: Colors.surfaceLight,
  },
  actionText: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.body(FontSize.md),
    fontFamily: FontFamily.bodySemi,
    color: Colors.text,
  },
  actionTextDanger: {
    color: Colors.wrong,
  },
  actionHint: {
    fontSize: FontSize.xs,
    lineHeight: LineHeight.body(FontSize.xs),
    color: Colors.textLight,
  },
  confirm: {
    gap: Spacing.sm,
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.heading(FontSize.lg),
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
  },
  confirmBody: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.body(FontSize.sm),
    color: Colors.textSecondary,
  },
  confirmActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  confirmSpinner: {
    marginTop: Spacing.md,
  },
});
