/**
 * Anki-inspired spaced repetition scheduler (SM-2).
 *
 * Cards move through four states, exactly like Anki:
 *   new -> learning -> review, and review -> relearning -> review on a lapse.
 *
 * A card in `learning`/`relearning` walks a list of short steps measured in
 * minutes. Once it clears the last step it "graduates" into `review`, where
 * intervals are measured in days and grow by the card's ease factor.
 *
 * Everything here is pure: `reviewCard` takes a card plus a grade and returns
 * the next card. Persistence lives in `src/services/srsService.ts`.
 */

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/** The four Anki answer buttons. */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export const REVIEW_RATINGS: ReviewRating[] = ['again', 'hard', 'good', 'easy'];

export interface SrsCard {
  /** Stable identity for the card (content + direction). */
  key: string;
  state: CardState;
  /** SM-2 ease factor. 2.5 is the default; it never drops below 1.3. */
  ease: number;
  /** Review interval in days. 0 until the card graduates. */
  intervalDays: number;
  /** Position in the learning/relearning step list. */
  stepIndex: number;
  /** Epoch ms the card next becomes due. */
  dueAt: number;
  reps: number;
  lapses: number;
  /** Epoch ms the card was first answered — drives the daily new-card cap. */
  introducedAt: number | null;
  lastReviewedAt: number | null;
}

export const SRS_CONFIG = {
  /** Minutes between steps while learning a new card. */
  learningStepsMinutes: [1, 10],
  /** Minutes between steps while relearning a lapsed card. */
  relearningStepsMinutes: [10],
  /** Interval given when a card graduates out of learning. */
  graduatingIntervalDays: 1,
  /** Interval given when a learning card is answered "easy". */
  easyIntervalDays: 4,
  startingEase: 2.5,
  minimumEase: 1.3,
  /** How each grade nudges the ease factor (review cards only). */
  easeDelta: { again: -0.2, hard: -0.15, good: 0, easy: 0.15 },
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  /** Fraction of the old interval kept after a lapse. */
  lapseIntervalMultiplier: 0,
  minimumIntervalDays: 1,
  maximumIntervalDays: 365,
  /** Intervals shorter than this are not fuzzed. */
  fuzzThresholdDays: 3,
  fuzzRatio: 0.05,
  /** Cap on brand-new cards introduced per day — this is the micro-learning dial. */
  newCardsPerDay: 12,
  /**
   * If nothing is due, cards in learning that come due within this window can
   * be shown early rather than stranding the user on an empty deck.
   */
  learnAheadMinutes: 20,
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function clampEase(ease: number): number {
  return Math.max(SRS_CONFIG.minimumEase, Number(ease.toFixed(4)));
}

function clampInterval(days: number): number {
  return Math.min(
    SRS_CONFIG.maximumIntervalDays,
    Math.max(SRS_CONFIG.minimumIntervalDays, Math.round(days))
  );
}

/**
 * Anki spreads due dates so cards reviewed together don't stay clumped
 * together forever. Short intervals are left alone.
 */
function fuzzInterval(days: number, applyFuzz: boolean): number {
  if (!applyFuzz || days < SRS_CONFIG.fuzzThresholdDays) return days;
  const spread = (Math.random() * 2 - 1) * SRS_CONFIG.fuzzRatio;
  return clampInterval(days * (1 + spread));
}

export function createCard(key: string, now: number = Date.now()): SrsCard {
  return {
    key,
    state: 'new',
    ease: SRS_CONFIG.startingEase,
    intervalDays: 0,
    stepIndex: 0,
    dueAt: now,
    reps: 0,
    lapses: 0,
    introducedAt: null,
    lastReviewedAt: null,
  };
}

interface ReviewOptions {
  /** Disabled when previewing intervals, so button labels stay stable. */
  fuzz?: boolean;
}

/** Grade a card and return its next scheduling state. */
export function reviewCard(
  card: SrsCard,
  rating: ReviewRating,
  now: number = Date.now(),
  options: ReviewOptions = {}
): SrsCard {
  const applyFuzz = options.fuzz ?? true;
  const answered: SrsCard = {
    ...card,
    reps: card.reps + 1,
    lastReviewedAt: now,
    introducedAt: card.introducedAt ?? now,
  };

  if (card.state === 'review') {
    return scheduleReview(answered, rating, now, applyFuzz);
  }

  const mode = card.state === 'relearning' ? 'relearning' : 'learning';
  return scheduleLearning(answered, rating, now, applyFuzz, mode);
}

function scheduleLearning(
  card: SrsCard,
  rating: ReviewRating,
  now: number,
  applyFuzz: boolean,
  mode: 'learning' | 'relearning'
): SrsCard {
  const steps =
    mode === 'learning'
      ? SRS_CONFIG.learningStepsMinutes
      : SRS_CONFIG.relearningStepsMinutes;

  if (rating === 'easy') {
    return graduate(card, mode, true, now, applyFuzz);
  }

  if (rating === 'again') {
    return { ...card, state: mode, stepIndex: 0, dueAt: now + steps[0] * MINUTE_MS };
  }

  if (rating === 'hard') {
    // Hard repeats the step the card is already sitting on.
    const stepIndex = Math.min(card.stepIndex, steps.length - 1);
    return { ...card, state: mode, stepIndex, dueAt: now + steps[stepIndex] * MINUTE_MS };
  }

  // Good: advance one step, or graduate off the end of the list.
  const nextStep = card.stepIndex + 1;
  if (nextStep < steps.length) {
    return { ...card, state: mode, stepIndex: nextStep, dueAt: now + steps[nextStep] * MINUTE_MS };
  }
  return graduate(card, mode, false, now, applyFuzz);
}

/**
 * Move a card out of (re)learning and back into the day-scale review queue.
 * Ease is untouched here — learning steps never change ease in Anki; the
 * lapse itself already applied the penalty.
 */
function graduate(
  card: SrsCard,
  mode: 'learning' | 'relearning',
  easy: boolean,
  now: number,
  applyFuzz: boolean
): SrsCard {
  const intervalDays =
    mode === 'learning'
      ? easy
        ? SRS_CONFIG.easyIntervalDays
        : SRS_CONFIG.graduatingIntervalDays
      : // A relearning card carries its post-lapse interval in intervalDays.
        clampInterval(easy ? card.intervalDays + 1 : card.intervalDays);

  const scheduled = fuzzInterval(clampInterval(intervalDays), applyFuzz);

  return {
    ...card,
    state: 'review',
    stepIndex: 0,
    intervalDays: scheduled,
    dueAt: now + scheduled * DAY_MS,
  };
}

function scheduleReview(
  card: SrsCard,
  rating: ReviewRating,
  now: number,
  applyFuzz: boolean
): SrsCard {
  if (rating === 'again') {
    const lapsedInterval = clampInterval(
      card.intervalDays * SRS_CONFIG.lapseIntervalMultiplier
    );
    return {
      ...card,
      state: 'relearning',
      ease: clampEase(card.ease + SRS_CONFIG.easeDelta.again),
      lapses: card.lapses + 1,
      stepIndex: 0,
      // Held for graduation out of relearning.
      intervalDays: lapsedInterval,
      dueAt: now + SRS_CONFIG.relearningStepsMinutes[0] * MINUTE_MS,
    };
  }

  const previous = Math.max(card.intervalDays, SRS_CONFIG.minimumIntervalDays);
  // Answering late is evidence the card was known for longer than scheduled,
  // so the overdue days count toward the next interval.
  const daysLate = Math.max(0, (now - card.dueAt) / DAY_MS);

  let ease = card.ease;
  let nextInterval: number;

  if (rating === 'hard') {
    ease = clampEase(card.ease + SRS_CONFIG.easeDelta.hard);
    nextInterval = Math.max(previous * SRS_CONFIG.hardMultiplier, previous);
  } else if (rating === 'good') {
    nextInterval = Math.max((previous + daysLate / 2) * ease, previous + 1);
  } else {
    ease = clampEase(card.ease + SRS_CONFIG.easeDelta.easy);
    nextInterval = Math.max(
      (previous + daysLate) * ease * SRS_CONFIG.easyBonus,
      previous + 1
    );
  }

  const scheduled = fuzzInterval(clampInterval(nextInterval), applyFuzz);

  return {
    ...card,
    state: 'review',
    ease,
    stepIndex: 0,
    intervalDays: scheduled,
    dueAt: now + scheduled * DAY_MS,
  };
}

/** How long each button would push the card out, for the button labels. */
export function previewIntervals(
  card: SrsCard,
  now: number = Date.now()
): Record<ReviewRating, string> {
  return REVIEW_RATINGS.reduce((acc, rating) => {
    const next = reviewCard(card, rating, now, { fuzz: false });
    acc[rating] = formatDuration(next.dueAt - now);
    return acc;
  }, {} as Record<ReviewRating, string>);
}

/** Compact duration label in Anki's style: `10m`, `1d`, `2mo`. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now';

  const minutes = ms / MINUTE_MS;
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;

  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;

  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;

  return `${(days / 365).toFixed(1)}y`;
}

export function isSameLocalDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/** Cards first answered today — counted against `newCardsPerDay`. */
export function countIntroducedToday(cards: SrsCard[], now: number = Date.now()): number {
  return cards.filter((card) => card.introducedAt !== null && isSameLocalDay(card.introducedAt, now))
    .length;
}

export function remainingNewToday(cards: SrsCard[], now: number = Date.now()): number {
  return Math.max(0, SRS_CONFIG.newCardsPerDay - countIntroducedToday(cards, now));
}

export interface QueueSummary {
  /** Unseen cards still allowed under today's new-card cap. */
  newCount: number;
  /** Cards in learning/relearning that are due now. */
  learningCount: number;
  /** Graduated cards that are due now. */
  reviewCount: number;
  dueTotal: number;
  /** Earliest due time across the whole deck, or null for an empty deck. */
  nextDueAt: number | null;
}

export function summarizeQueue(cards: SrsCard[], now: number = Date.now()): QueueSummary {
  const learnAheadCutoff = now + SRS_CONFIG.learnAheadMinutes * MINUTE_MS;

  const newCount = Math.min(
    cards.filter((card) => card.state === 'new').length,
    remainingNewToday(cards, now)
  );
  // Counted from the moment the queue is willing to serve them, which includes
  // the learn-ahead window. Counting only what is due this instant would leave
  // the header reading zero while the deck kept dealing cards.
  const learningCount = cards.filter(
    (card) => isLearning(card) && card.dueAt <= learnAheadCutoff
  ).length;
  const reviewCount = cards.filter(
    (card) => card.state === 'review' && card.dueAt <= now
  ).length;

  const upcoming = cards
    .filter((card) => card.state !== 'new')
    .filter((card) => (isLearning(card) ? card.dueAt > learnAheadCutoff : card.dueAt > now))
    .map((card) => card.dueAt);

  return {
    newCount,
    learningCount,
    reviewCount,
    dueTotal: newCount + learningCount + reviewCount,
    nextDueAt: upcoming.length > 0 ? Math.min(...upcoming) : null,
  };
}

function isLearning(card: SrsCard): boolean {
  return card.state === 'learning' || card.state === 'relearning';
}

export interface PickOptions {
  /** Avoid repeating the card just answered unless it is the only option. */
  excludeKey?: string | null;
  /** Ignore due dates entirely and take the earliest-due card. */
  studyAhead?: boolean;
}

/**
 * Choose the next card to show, in Anki's priority order: overdue learning
 * cards, then due reviews, then new cards, then (as a fallback) learning cards
 * coming due shortly.
 */
export function pickNextCard(
  cards: SrsCard[],
  now: number = Date.now(),
  options: PickOptions = {}
): SrsCard | null {
  // The daily new-card budget is always measured against the whole deck, even
  // when the pool has been narrowed to avoid a repeat.
  const newBudget = remainingNewToday(cards, now);
  const pick = (pool: SrsCard[]) =>
    selectFrom(pool, now, options.studyAhead ?? false, newBudget);

  const withoutExcluded = options.excludeKey
    ? cards.filter((card) => card.key !== options.excludeKey)
    : cards;

  return pick(withoutExcluded) ?? (options.excludeKey ? pick(cards) : null);
}

function selectFrom(
  cards: SrsCard[],
  now: number,
  studyAhead: boolean,
  newBudget: number
): SrsCard | null {
  if (cards.length === 0) return null;

  const dueLearning = cards
    .filter((card) => isLearning(card) && card.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
  if (dueLearning.length > 0) return dueLearning[0];

  const dueReviews = cards.filter((card) => card.state === 'review' && card.dueAt <= now);
  if (dueReviews.length > 0) {
    return dueReviews[Math.floor(Math.random() * dueReviews.length)];
  }

  const newCards = cards.filter((card) => card.state === 'new');
  if (newCards.length > 0 && (studyAhead || newBudget > 0)) {
    return newCards[0];
  }

  const learnAheadCutoff = now + SRS_CONFIG.learnAheadMinutes * MINUTE_MS;
  const soonLearning = cards
    .filter((card) => isLearning(card) && card.dueAt <= learnAheadCutoff)
    .sort((a, b) => a.dueAt - b.dueAt);
  if (soonLearning.length > 0) return soonLearning[0];

  if (studyAhead) {
    return [...cards].sort((a, b) => a.dueAt - b.dueAt)[0] ?? null;
  }

  return null;
}
