import { create } from 'zustand';
import type { WordEntry } from '@/src/types';

/**
 * App-wide "quick add to glossary" sheet (WAN-40). The floating + button
 * opens it from any main screen; screens that show the glossary listen to
 * `lastAdded` to merge the new word into their list without refetching.
 */
interface QuickAddState {
  isOpen: boolean;
  lastAdded: WordEntry | null;
  open: () => void;
  close: () => void;
  /** Closes the sheet unless `keepOpen` (e.g. to show a recording upload error). */
  wordAdded: (word: WordEntry, keepOpen?: boolean) => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  isOpen: false,
  lastAdded: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  wordAdded: (word, keepOpen = false) => set({ isOpen: keepOpen, lastAdded: word }),
}));
