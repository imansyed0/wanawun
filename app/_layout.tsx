import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign In', presentation: 'modal' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Sign Up', presentation: 'modal' }} />
        <Stack.Screen name="game/lobby" options={{ title: 'Find a Game' }} />
        <Stack.Screen name="game/sync/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="game/async/list" options={{ title: 'My Games' }} />
        <Stack.Screen name="game/async/[id]" options={{ title: 'Koshur Messenger' }} />
        <Stack.Screen name="game/async/new" options={{ title: 'New Messenger Game', presentation: 'modal' }} />
        <Stack.Screen name="lessons/[courseId]/[lessonId]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="lessons/[id]" options={{ title: 'Lesson', headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
