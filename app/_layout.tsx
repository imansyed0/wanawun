import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Apply Space Grotesk as the default font for every Text / TextInput in the app.
// Done at module scope so the default is in place before the first render,
// instead of inside a useEffect (which fires after children already mounted).
// Individual styles can still override with Fraunces for headings/display.
const DEFAULT_FONT_STYLE = { fontFamily: 'SpaceGrotesk_400Regular' as const };
// @ts-expect-error - defaultProps exists at runtime on Text/TextInput
Text.defaultProps = Text.defaultProps || {};
// @ts-expect-error
Text.defaultProps.style = [DEFAULT_FONT_STYLE, Text.defaultProps.style];
// @ts-expect-error
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-expect-error
TextInput.defaultProps.style = [DEFAULT_FONT_STYLE, TextInput.defaultProps.style];

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.documentElement.style.fontFamily = 'SpaceGrotesk_400Regular, system-ui, sans-serif';
    document.body.style.fontFamily = 'SpaceGrotesk_400Regular, system-ui, sans-serif';
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign In', presentation: 'modal' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Sign Up', presentation: 'modal' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
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
