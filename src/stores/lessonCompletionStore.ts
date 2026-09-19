import { create } from 'zustand';

/**
 * The lesson that just met both halves of done — its audio played out and a
 * word was kept from it. The player sets it on its way back to the course's
 * lesson list, which celebrates the tick appearing.
 */
export interface JustCompletedLesson {
  courseId: string;
  lessonId: string;
  /** When it finished — doubles as the id of the celebration to play. */
  at: number;
}

interface LessonCompletionState {
  justCompleted: JustCompletedLesson | null;
  lessonCompleted: (courseId: string, lessonId: string) => void;
  clear: () => void;
}

export const useLessonCompletionStore = create<LessonCompletionState>((set) => ({
  justCompleted: null,
  lessonCompleted: (courseId, lessonId) =>
    set({ justCompleted: { courseId, lessonId, at: Date.now() } }),
  clear: () => set({ justCompleted: null }),
}));
