import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Colors, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses } from '@/src/data/courses';
import { getFullyListenedLessonIds } from '@/src/services/clipProgressService';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const course = allCourses.find((c) => c.id === id);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!id || !course) return;
      getFullyListenedLessonIds(id, course.lessons)
        .then((ids) => setCompletedLessonIds(new Set(ids)))
        .catch(() => {});
    }, [id, course])
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
          <Text style={styles.title} numberOfLines={1}>
            {course.title}
          </Text>
          <Text style={styles.author}>{course.author}</Text>
        </View>
      </View>

      <FlatList
        data={course.lessons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isCompleted = completedLessonIds.has(item.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.lessonCard, pressed && { opacity: 0.7 }]}
              onPress={() =>
                router.push(`/lessons/${course.id}/${item.id}`)
              }
            >
              <View style={[styles.lessonNumber, isCompleted && styles.lessonNumberCompleted]}>
                <Text style={styles.lessonNumberText}>{item.number}</Text>
                {isCompleted && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkText}>{'\u2713'}</Text>
                  </View>
                )}
              </View>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle}>{item.title}</Text>
                <Text style={styles.lessonMeta}>
                  {item.audioClips.length} clip{item.audioClips.length !== 1 ? 's' : ''}
                  {item.images && item.images.length > 0
                    ? ` \u00B7 ${item.images.length} image${item.images.length !== 1 ? 's' : ''}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
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
  headerInfo: { flex: 1 },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primaryDark },
  author: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  lessonCard: {
    flexDirection: 'row',
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
    fontWeight: '700',
    lineHeight: 14,
  },
  lessonNumberText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  lessonInfo: { flex: 1 },
  lessonTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  lessonMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  chevron: { fontSize: 24, color: Colors.textLight },
  errorText: {
    textAlign: 'center',
    color: Colors.wrong,
    fontSize: FontSize.lg,
    marginTop: Spacing.xxl,
  },
});
