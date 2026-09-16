import { create } from 'zustand';
import { pauseAllAudio } from '@/src/services/audioService';
import type { LessonVocabEntry } from '@/src/services/lessonService';
import type { WordEntry } from '@/src/types';

/**
 * App-wide "quick add to glossary" sheet (WAN-40). The floating + button
 * opens it from any main screen; screens that show the glossary listen to
 * `lastAdded` to merge the new word into their list without refetching.
 */
export interface QuickAddPrefill {
  english?: string;
  kashmiri?: string;
}

/** The lesson on screen, so words added while it's open are saved to it. */
export interface QuickAddLessonContext {
  lessonId: string;
  courseId: string;
}

interface QuickAddState {
  isOpen: boolean;
  lastAdded: WordEntry | null;
  /** Values to start the sheet with, e.g. a word tapped in a lesson translation. */
  prefill: QuickAddPrefill | null;
  /** Set while a lesson screen is focused; null everywhere else. */
  lessonContext: QuickAddLessonContext | null;
  /** The latest word saved to a lesson, so that lesson's Words tab can show it. */
  lastAddedLessonVocab: LessonVocabEntry | null;
  open: (prefill?: QuickAddPrefill) => void;
  close: () => void;
  /** Closes the sheet unless `keepOpen` (e.g. to show a recording upload error). */
  wordAdded: (word: WordEntry, keepOpen?: boolean) => void;
  setLessonContext: (context: QuickAddLessonContext | null) => void;
  lessonVocabAdded: (entry: LessonVocabEntry) => void;
  /** Bumped when someone presses play, so the + button can glow as a reminder. */
  playNudge: number;
  nudgeAddButton: () => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  isOpen: false,
  lastAdded: null,
  prefill: null,
  lessonContext: null,
  lastAddedLessonVocab: null,
  setLessonContext: (lessonContext) => set({ lessonContext }),
  lessonVocabAdded: (entry) => set({ lastAddedLessonVocab: entry }),
  playNudge: 0,
  nudgeAddButton: () => set((s) => ({ playNudge: s.playNudge + 1 })),
  open: (prefill) => {
    // Don't let a lesson clip or pronunciation talk over typing or recording.
    void pauseAllAudio();
    set({ isOpen: true, prefill: prefill ?? null });
  },
  close: () => set({ isOpen: false, prefill: null }),
  wordAdded: (word, keepOpen = false) =>
    set(keepOpen ? { lastAdded: word } : { isOpen: false, lastAdded: word, prefill: null }),
}));
