import { create } from 'zustand';
import { pauseAllAudio } from '@/src/services/audioService';
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

interface QuickAddState {
  isOpen: boolean;
  lastAdded: WordEntry | null;
  /** Values to start the sheet with, e.g. a word tapped in a lesson translation. */
  prefill: QuickAddPrefill | null;
  open: (prefill?: QuickAddPrefill) => void;
  close: () => void;
  /** Closes the sheet unless `keepOpen` (e.g. to show a recording upload error). */
  wordAdded: (word: WordEntry, keepOpen?: boolean) => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  isOpen: false,
  lastAdded: null,
  prefill: null,
  open: (prefill) => {
    // Don't let a lesson clip or pronunciation talk over typing or recording.
    void pauseAllAudio();
    set({ isOpen: true, prefill: prefill ?? null });
  },
  close: () => set({ isOpen: false, prefill: null }),
  wordAdded: (word, keepOpen = false) =>
    set(keepOpen ? { lastAdded: word } : { isOpen: false, lastAdded: word, prefill: null }),
}));
