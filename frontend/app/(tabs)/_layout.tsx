import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../src/contexts/AppContext';

export default function TabsLayout() {
  const { t, syncQueueCount } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.divider,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: t.tabs.directory,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
          ),
          tabBarButtonTestID: 'tab-directory',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t.tabs.scan,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={22} color={color} />
          ),
          tabBarButtonTestID: 'tab-scan',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={22} color={color} />
          ),
          tabBarButtonTestID: 'tab-map',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
              {syncQueueCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{syncQueueCount}</Text>
                </View>
              )}
            </View>
          ),
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4, right: -8,
    backgroundColor: Colors.accent,
    borderRadius: 10, minWidth: 18, height: 18,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 10, fontFamily: 'DMSans_700Bold' },
});
