import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { Colors } from '@/src/constants/theme';

export default function AppIndexRedirect() {
  return (
    <View style={styles.container}>
      <Redirect href="/lessons" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
