import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/src/components/ui/Card';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';
import { allCourses } from '@/src/data/courses';

const badges: Record<string, { label: string; color: string }> = {
  'spoken-kashmiri': { label: '50 chapters', color: Colors.primary },
  'kashmiri-koul': { label: '4 lessons', color: Colors.accent },
  ciil: { label: '41 programmes', color: Colors.secondary },
  'learn-kashmiri': { label: '12 tracks', color: Colors.primaryLight },
};

export default function LessonsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lessons</Text>
        <Text style={styles.subtitle}>Audio courses from koshur.org</Text>
      </View>

      <FlatList
        data={allCourses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const badge = badges[item.id];
          return (
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/lessons/${item.id}`)}
            >
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: badge.color }]}>
                      <Text style={styles.badgeText}>{badge.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primaryDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: { gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  author: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  description: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },
});
