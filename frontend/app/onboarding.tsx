import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Storage } from '../src/services/storage';
import { useApp } from '../src/contexts/AppContext';
import { Colors, Spacing, Typography, Radius } from '../src/theme';
import { Button } from '../src/components/Button';

const { width } = Dimensions.get('window');

const SLIDES_IMAGES = [
  'https://static.prod-images.emergentagent.com/jobs/01bc7a24-6841-47ee-8fcc-c01d9b3ffb38/images/15756694da4f7fd53bb2e6600fe1a4ba2e2b97401ac3cd7bbb79d9dbd7a95db9.png',
  'https://static.prod-images.emergentagent.com/jobs/01bc7a24-6841-47ee-8fcc-c01d9b3ffb38/images/4350b8fbd9d7b8019392ca81c3dedfc5d89ed5079c7bc16390b94645f947ec22.png',
  'https://static.prod-images.emergentagent.com/jobs/01bc7a24-6841-47ee-8fcc-c01d9b3ffb38/images/c6636cb2c2c71c0998dd955b10e0d0632556e55f8c8ea89d752e8724e0b4b9f9.png',
];

export default function Onboarding() {
  const router = useRouter();
  const { t, language, setLanguage } = useApp();
  const [idx, setIdx] = useState(0);

  const slides = [
    { title: t.onboarding.slide1Title, body: t.onboarding.slide1Body },
    { title: t.onboarding.slide2Title, body: t.onboarding.slide2Body },
    { title: t.onboarding.slide3Title, body: t.onboarding.slide3Body },
  ];

  const finish = async () => {
    await Storage.markOnboarded();
    router.replace('/(tabs)');
  };

  const next = () => {
    if (idx < slides.length - 1) setIdx(idx + 1);
    else finish();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="onboarding-screen">
      <View style={styles.topRow}>
        <View style={styles.langRow}>
          <TouchableOpacity
            testID="lang-fr-btn"
            onPress={() => setLanguage('fr')}
            style={[styles.langChip, language === 'fr' && styles.langChipActive]}
          >
            <Text style={[styles.langTxt, language === 'fr' && styles.langTxtActive]}>FR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="lang-en-btn"
            onPress={() => setLanguage('en')}
            style={[styles.langChip, language === 'en' && styles.langChipActive]}
          >
            <Text style={[styles.langTxt, language === 'en' && styles.langTxtActive]}>EN</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={finish} testID="onboarding-skip-btn">
          <Text style={styles.skip}>{t.onboarding.skip}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}>
        <Image source={{ uri: SLIDES_IMAGES[idx] }} style={styles.image} resizeMode="cover" />
        <Text style={styles.title} testID="onboarding-title">{slides[idx].title}</Text>
        <Text style={styles.body}>{slides[idx].body}</Text>
      </ScrollView>

      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottom}>
        <Button
          testID="onboarding-next-btn"
          label={idx === slides.length - 1 ? t.onboarding.getStarted : t.onboarding.next}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.divider,
  },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langTxt: { fontFamily: 'DMSans_700Bold', color: Colors.textSecondary, fontSize: 13 },
  langTxtActive: { color: Colors.white },
  skip: { ...Typography.label, color: Colors.textSecondary },
  image: { width: width - Spacing.lg * 2, height: 280, borderRadius: Radius.xl, marginBottom: Spacing.xl },
  title: { ...Typography.h1, textAlign: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  body: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.lg },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.divider },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
  bottom: { paddingBottom: Spacing.md },
});
