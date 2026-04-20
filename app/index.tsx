import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Colors } from '@/src/constants/theme';
import { hasSeenOnboarding } from '@/src/services/onboardingService';

export default function AppIndexRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    hasSeenOnboarding()
      .then((seen) => setTarget(seen ? '/lessons' : '/onboarding'))
      .catch(() => setTarget('/lessons'));
  }, []);

  if (!target) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Redirect href={target as '/lessons' | '/onboarding'} />
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
