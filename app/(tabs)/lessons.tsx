import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/src/components/ui/Card';
import { ScreenHeaderDecoration } from '@/src/components/ui/KashmiriPattern';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/src/constants/theme';
import { allCourses } from '@/src/data/courses';

const badges: Record<string, { label: string; color: string }> = {
  'spoken-kashmiri': { label: '50 chapters', color: Colors.primary },
  'kashmiri-koul': { label: '4 lessons', color: Colors.accent },
  ciil: { label: '41 programmes', color: Colors.secondary },
  'learn-kashmiri': { label: '12 tracks', color: Colors.primaryLight },
};

const icons: Record<string, string> = {
  'spoken-kashmiri': '\u{1F5E3}',  // speaking head
  'kashmiri-koul': '\u{1F4DA}',    // books
  ciil: '\u{1F399}',               // studio microphone
  'learn-kashmiri': '\u{1F3B6}',   // musical notes
};

export default function LessonsScreen() {
  const router = useRouter();

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

      <FlatList
        data={allCourses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const badge = badges[item.id];
          const icon = icons[item.id] ?? '\u{1F3B5}';
          return (
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/lessons/${item.id}`)}
            >
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.courseIcon}>{icon}</Text>
                  <View style={styles.cardTitleArea}>
                    <Text style={styles.courseTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.author}>{item.author}</Text>
                    {badge && (
                      <View style={[styles.badge, { backgroundColor: badge.color }]}>
                        <Text style={styles.badgeText}>{badge.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: FontSize.xxl, fontFamily: FontFamily.headingBold, color: Colors.primaryDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: { gap: Spacing.sm },
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
    lineHeight: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: FontSize.xs, fontFamily: FontFamily.bodyBold, color: '#fff', letterSpacing: 0.5 },
  author: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  description: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },
});
