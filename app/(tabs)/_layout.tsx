import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '@/src/constants/theme';
import { SymbolView } from 'expo-symbols';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="lessons"
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 11,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Lessons',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'headphones', android: 'headphones', web: 'headphones' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Glossary',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'book.fill', android: 'menu_book', web: 'menu_book' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Play',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Flashcards',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'rectangle.fill.on.rectangle.fill', android: 'style', web: 'style' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor={color} size={28} />
          ),
        }}
      />
    </Tabs>
  );
}
