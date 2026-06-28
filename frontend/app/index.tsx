import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Storage } from '../src/services/storage';
import { Colors, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';

export default function Index() {
  const router = useRouter();
  const { ready } = useApp();
  const fade = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const onboarded = await Storage.isOnboarded();
      setTimeout(() => {
        router.replace(onboarded ? '/(tabs)' : '/onboarding');
      }, 1100);
    })();
  }, [ready, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>EFYL</Text>
        </View>
        <Text style={styles.title}>EFYL AddressBook</Text>
        <Text style={styles.tag}>Votre adresse. Partout.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    color: Colors.white,
    letterSpacing: 1,
  },
  title: {
    ...Typography.h1,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  tag: {
    ...Typography.body,
    color: Colors.accentLight,
    fontFamily: 'DMSans_500Medium',
  },
});
