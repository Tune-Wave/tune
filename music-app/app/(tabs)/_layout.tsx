import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8A2BE2',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5'
        }
      }}
    >
      <Tabs.Screen
        name="home" // This screen serves as Home
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="Search" // Adding search screen to tabs
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="NowPlaying"
        options={{
          title: 'Now Playing',
          tabBarIcon: ({ color }) => <Ionicons name="musical-notes" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="LibraryScreen"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Ionicons name="library" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}