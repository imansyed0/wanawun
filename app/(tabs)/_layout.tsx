import React from 'react';
import { View } from 'react-native';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, TabBarContentHeight } from '@/src/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@/src/hooks/useAuth';

const TAB_ICON_SIZE = 26;

export default function TabLayout() {
  const { user, loading } = useAuth();

  // Every tab needs an account. This also catches signing out and deep links.
  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  if (!user) return <Redirect href={'/welcome' as Href} />;

  // Naani's overlay is mounted in the root layout, so she stays on screen when
  // a step sends someone into a lesson.
  return <TabsNav />;
}

function TabsNav() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="learn"
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        headerShown: false,
        // The bar has to be tall enough for a 26px icon plus a full line of
        // label. The default 49px bar left the labels with 6px of room and
        // React Navigation's label wrapper clips what doesn't fit, so
        // "Flashcards" and friends were sliced in half.
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: TabBarContentHeight + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarIconStyle: {
          height: TAB_ICON_SIZE,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.bodySemi,
          fontSize: 11,
          lineHeight: 15,
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Glossary',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'book.fill', android: 'menu_book', web: 'menu_book' }} tintColor={color} size={TAB_ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Lessons',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'headphones', android: 'headphones', web: 'headphones' }} tintColor={color} size={TAB_ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Play',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' }} tintColor={color} size={TAB_ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Flashcards',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'rectangle.fill.on.rectangle.fill', android: 'style', web: 'style' }} tintColor={color} size={TAB_ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor={color} size={TAB_ICON_SIZE} />
          ),
        }}
      />
    </Tabs>
  );
}
