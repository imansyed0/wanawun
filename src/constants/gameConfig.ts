export const SYNC_GAME = {
  ROUNDS_PER_GAME: 10,
  OPTIONS_PER_ROUND: 4,
  TIME_PER_ROUND_MS: 10000, // 10 seconds
  POINTS_CORRECT: 100,
  POINTS_SPEED_BONUS_MAX: 50,
  POINTS_WRONG_PENALTY: -25,
  STREAK_MULTIPLIER_THRESHOLD: 3,
  STREAK_MULTIPLIER: 1.5,
};

export const ASYNC_GAME = {
  ROUNDS_PER_GAME: 5, // best of 5
  TURN_TIME_LIMIT_HOURS: 24,
  POINTS_CORRECT_TRANSLATION: 100,
  POINTS_SPOT_TRAP: 150,
  POINTS_CORRECT_WORD: 50, // bonus for providing the correct replacement
  POINTS_SPEED_BONUS: 25, // answer within 1 hour
};

export const WORD_CATEGORIES = [
  'family',
  'food',
  'nature',
  'body',
  'household',
  'actions',
  'descriptions',
  'places',
  'numbers',
  'time',
  'clothing',
  'religion',
  'other',
] as const;

export type WordCategory = typeof WORD_CATEGORIES[number];
