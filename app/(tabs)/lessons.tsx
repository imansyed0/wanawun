import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses, recommendedCourseId, type Course } from '@/src/data/courses';
import { getStartedLessonIds } from '@/src/services/clipProgressService';
import { getLearnerLevel, LEVEL_LABELS } from '@/src/services/starterGlossaryService';
import { useAuth } from '@/src/hooks/useAuth';

// Colour only. The count is read off the course itself so it can't drift out of
// step with the lessons actually in it, and every course counts in "lessons".
const badgeColors: Record<string, string> = {
  'spoken-kashmiri': Colors.primary,
  'kashmiri-koul': Colors.accent,
  ciil: Colors.secondary,
  'learn-kashmiri': Colors.primaryLight,
};

const icons: Record<string, string> = {
  'spoken-kashmiri': '\u{1F5E3}',  // speaking head
  'kashmiri-koul': '\u{1F4DA}',    // books
  ciil: '\u{1F399}',               // studio microphone
  'learn-kashmiri': '\u{1F3B6}',   // musical notes
};

/** How far along a course is, and which lesson to pick up next. */
interface CourseProgress {
  /** Lessons that count as done — the same thing the lesson list ticks. */
  done: number;
  /** Title of the lesson after the last one ticked off; null at the end. */
  upNext: string | null;
}

function courseProgress(course: Course, startedIds: string[]): CourseProgress {
  const started = new Set(startedIds);
  // Pick up after the furthest lesson they've finished, not the first gap:
  // having done 2 and 4, the next one up is 5.
  let lastDone = -1;
  course.lessons.forEach((lesson, index) => {
    if (started.has(lesson.id)) lastDone = index;
  });
  return {
    done: started.size,
    upNext: course.lessons[lastDone + 1]?.title ?? null,
  };
}

/** Everything the cards read, gathered in one go for one signed-in learner. */
interface CourseState {
  /** The course to begin with, from the level they gave Naani. */
  startHereId: string | null;
  progress: Record<string, CourseProgress>;
}

export default function LessonsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  // Null until it has been gathered. The recommendation and the counts live in
  // one piece of state, and land together: apart, a reread could pair a fresh
  // recommendation with the last one's counts, and "start here" would appear
  // on a course the learner is already partway through.
  const [courseState, setCourseState] = useState<CourseState | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Nothing is worth reading until we know who is asking. Signed-in
      // learners look signed out for a moment while the session is restored,
      // and answering then means an empty glossary and someone else's level.
      if (authLoading) return;

      let cancelled = false;
      (async () => {
        let startHereId: string | null = null;
        try {
          const level = await getLearnerLevel(user?.id);
          startHereId = level ? recommendedCourseId(level) : null;
        } catch {
          // No recommendation rather than no list.
        }

        const counted = await Promise.all(
          allCourses.map(async (course) => {
            try {
              const ids = await getStartedLessonIds(user?.id, course.id, course.lessons);
              return [course.id, courseProgress(course, ids)] as const;
            } catch {
              // Leave this course without a count rather than blocking the list.
              return [course.id, { done: 0, upNext: null }] as const;
            }
          })
        );
        if (cancelled) return;
        setCourseState({ startHereId, progress: Object.fromEntries(counted) });
      })();
      return () => {
        cancelled = true;
      };
    }, [authLoading, user?.id])
  );

  // Naani's pick leads the list. Everything else keeps its difficulty order, so
  // the list still reads gentlest-first once you're past the recommendation.
  const ordered = useMemo(() => {
    const startHereId = courseState?.startHereId;
    if (!startHereId) return allCourses;
    const pick = allCourses.find((course) => course.id === startHereId);
    if (!pick) return allCourses;
    return [pick, ...allCourses.filter((course) => course.id !== startHereId)];
  }, [courseState?.startHereId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Lessons</Text>
            <Text style={styles.subtitle}>Audio courses from koshur.org</Text>
          </View>
        </View>
      </View>

      <ScreenHeaderDecoration variant="green" />

      {/* Cards wait for the counts: a tick that lands late reads as a card that
          forgot what the learner has done. The header stays put meanwhile. */}
      {!courseState ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const badgeColor = badgeColors[item.id] ?? Colors.primary;
            const icon = icons[item.id] ?? '\u{1F3B5}';
            const courseDone = courseState?.progress[item.id];
            // Only worth pointing at until they've actually finished one — and only
            // once the counts are in, so it can't appear and then think better.
            const startHere = item.id === courseState?.startHereId && !courseDone?.done;
            return (
              <Pressable
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/lessons/${item.id}`)}
              >
                <Card style={[styles.card, startHere && styles.cardStartHere]}>
                  {startHere ? (
                    <Text style={styles.startHere}>Naani says: start here</Text>
                  ) : null}
                  <View style={styles.cardTop}>
                    <Text style={styles.courseIcon}>{icon}</Text>
                    <View style={styles.cardTitleArea}>
                      <Text style={styles.courseTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.author}>{item.author}</Text>
                      <View style={styles.chipRow}>
                        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                          <Text style={styles.badgeText}>
                            {item.lessons.length} lessons
                          </Text>
                        </View>
                        {/* The same answer Naani asked for, so the learner can
                            see which course is pitched at where they are. */}
                        <View style={styles.levelPill}>
                          <Text style={styles.levelPillText}>
                            {LEVEL_LABELS[item.level].short}
                          </Text>
                        </View>
                        {/* Only once something's done: "0 done" greets nobody well. */}
                        {courseDone?.done ? (
                          <View style={styles.progressPill}>
                            <Text style={styles.progressPillText}>
                              {'✓'} {courseDone.done} done
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.description}>{item.description}</Text>
                  {courseDone?.done && courseDone.upNext ? (
                    <Text style={styles.upNext} numberOfLines={1}>
                      Up next: {courseDone.upNext}
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: FontSize.xxl, fontFamily: FontFamily.headingBold, color: Colors.primaryDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: { gap: Spacing.sm },
  cardStartHere: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  startHere: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  courseIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  cardTitleArea: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  courseTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bodyBold,
    color: Colors.text,
    flexShrink: 1,
    lineHeight: LineHeight.body(FontSize.lg),
  },
  // Count and progress sit side by side; they wrap on a narrow card.
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: FontSize.xs, fontFamily: FontFamily.bodyBold, color: '#fff', letterSpacing: 0.5 },
  // Outlined rather than filled, so it reads as their own progress next to the
  // solid count badge instead of a second label about the course.
  levelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemi,
    color: Colors.textSecondary,
  },
  progressPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  progressPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyBold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  author: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    lineHeight: LineHeight.body(FontSize.sm),
  },
  upNext: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyBold,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
