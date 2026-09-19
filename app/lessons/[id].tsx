import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Celebration } from '@/src/components/ui/Celebration';
import { Colors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses } from '@/src/data/courses';
import { getStartedLessonIds } from '@/src/services/clipProgressService';
import { useAuth } from '@/src/hooks/useAuth';
import { useLessonCompletionStore } from '@/src/stores/lessonCompletionStore';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const course = allCourses.find((c) => c.id === id);
  const [startedLessonIds, setStartedLessonIds] = useState<Set<string>>(new Set());
  // Held back until the first read of their progress lands, so the ticks are
  // right on first paint instead of appearing a moment after the rows.
  const [loadingTicks, setLoadingTicks] = useState(true);
  // Set by the player when a lesson's last clip plays out, so the tick it just
  // earned arrives with confetti rather than just appearing.
  const justCompleted = useLessonCompletionStore((s) => s.justCompleted);
  const celebrating = justCompleted?.courseId === id ? justCompleted : null;
  // Keep the lesson just played ticked while its progress is still on its way
  // to the server and this screen reloads its counts.
  const [justFinishedId, setJustFinishedId] = useState<string | null>(null);
  const started = useMemo(
    () => (justFinishedId ? new Set([...startedLessonIds, justFinishedId]) : startedLessonIds),
    [startedLessonIds, justFinishedId]
  );

  // One party per finished lesson: forget it once it has been thrown.
  useEffect(() => {
    if (!celebrating) return;
    setJustFinishedId(celebrating.lessonId);
    const timer = setTimeout(() => useLessonCompletionStore.getState().clear(), 2000);
    return () => clearTimeout(timer);
  }, [celebrating]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !course) return;
      // Asking before the session is restored reads a signed-out learner's
      // (empty) progress, so wait for auth to settle first.
      if (authLoading) return;

      let cancelled = false;
      getStartedLessonIds(user?.id, id, course.lessons)
        .then((ids) => {
          if (!cancelled) setStartedLessonIds(new Set(ids));
        })
        .catch(() => {})
        .finally(() => {
          // Only the first paint waits: coming back from a lesson refreshes the
          // ticks in place rather than flashing a spinner over the list again.
          if (!cancelled) setLoadingTicks(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id, course, user?.id, authLoading])
  );

  if (!course) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Course not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>
            {course.title}
          </Text>
          <Text style={styles.author}>{course.author}</Text>
        </View>
      </View>

      {loadingTicks ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={course.lessons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isStarted = started.has(item.id);
            return (
              <Pressable
                style={({ pressed }) => [styles.lessonCard, pressed && { opacity: 0.7 }]}
                onPress={() =>
                  router.push(`/lessons/${course.id}/${item.id}`)
                }
              >
                {celebrating?.lessonId === item.id ? (
                  // Pinned left and twice as wide as the gap to the middle of the
                  // tick, so the confetti sprays up out of it and stays on the card.
                  <Celebration
                    id="lesson-tick"
                    trigger={celebrating.at}
                    width={(Spacing.md + 18) * 2}
                    height={Spacing.md + 36}
                    scale={0.62}
                    style={{ left: 0, top: 0 }}
                  />
                ) : null}
                <View style={[styles.lessonNumber, isStarted && styles.lessonNumberCompleted]}>
                  <Text style={styles.lessonNumberText}>{item.number}</Text>
                  {isStarted && (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>{'\u2713'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.lessonInfo}>
                  <Text style={styles.lessonTitle}>{item.title}</Text>
                </View>
                <Text style={styles.chevron}>{'\u203A'}</Text>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  backText: { fontSize: 24, color: Colors.primary },
  headerInfo: { flex: 1, minWidth: 0 },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
    flexShrink: 1,
    lineHeight: LineHeight.heading(FontSize.xl),
  },
  author: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  lessonCard: {
    flexDirection: 'row',
    // One line of title against a 36pt badge, so centre them on each other.
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  lessonNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberCompleted: {
    backgroundColor: Colors.primaryLight,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.correct,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    lineHeight: 14,
  },
  lessonNumberText: { color: '#fff', fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  lessonInfo: { flex: 1, minWidth: 0 },
  lessonTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemi,
    color: Colors.text,
    flexShrink: 1,
    lineHeight: 22,
  },
  chevron: { fontSize: 24, color: Colors.textLight },
  errorText: {
    textAlign: 'center',
    color: Colors.wrong,
    fontSize: FontSize.lg,
    marginTop: Spacing.xxl,
  },
});
