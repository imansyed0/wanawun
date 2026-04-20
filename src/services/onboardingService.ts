import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hasSeenOnboarding';

export async function hasSeenOnboarding(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, 'true');
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
