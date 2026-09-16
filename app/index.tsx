import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { Colors } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { hasSeenOnboarding } from '@/src/services/onboardingService';
import { getLearnerLevel } from '@/src/services/starterGlossaryService';
import { useTutorialStore } from '@/src/stores/tutorialStore';

export default function AppIndexRedirect() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [next, setNext] = useState<Href | null>(null);

  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    (async () => {
      // Naani's level question picks the starter words, so it has to come
      // before the tour and the first Glossary load. Accounts that signed in
      // without answering it (e.g. on a new phone) get asked now.
      const level = await getLearnerLevel(userId);
      if (cancelled) return;
      if (!level) {
        setNext('/welcome/level' as Href);
        return;
      }
      try {
        // First launch: Naani's guided tour runs on the real app,
        // starting from the Glossary tab.
        if (!(await hasSeenOnboarding()) && !cancelled) useTutorialStore.getState().start();
      } catch {
        // Skip the tour rather than block the app.
      }
      if (!cancelled) setNext('/learn');
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, userId]);

  // Signed out: Naani's welcome, which leads to her question and then an account.
  if (!loading && !userId) {
    return <Redirect href={'/welcome' as Href} />;
  }

  if (!next) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Redirect href={next} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
