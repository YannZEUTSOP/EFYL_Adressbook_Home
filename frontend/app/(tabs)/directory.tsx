// Répertoire EFYL — entry screen: pick a category of the central registry.
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Api } from '../../src/services/api';
import type { DirectoryCategory } from '../../src/services/api';

type Cat = {
  key: DirectoryCategory;
  icon: any;
  color: string;
  bg: string;
  title: string;
  desc: string;
};

export default function DirectoryTab() {
  const router = useRouter();
  const { t, isOnline } = useApp();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const r = await Api.directorySummary();
      setCounts(r.counts);
      setTotal(r.total);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cats: Cat[] = [
    { key: 'household', icon: 'home', color: Colors.primary, bg: '#E7F3EC',
      title: t.directory.catHousehold, desc: t.directory.catHouseholdDesc },
    { key: 'commerce', icon: 'storefront', color: Colors.accent, bg: '#FDF0E0',
      title: t.directory.catCommerce, desc: t.directory.catCommerceDesc },
    { key: 'public', icon: 'business', color: '#7C3AED', bg: '#EFE9FE',
      title: t.directory.catPublic, desc: t.directory.catPublicDesc },
    { key: 'heritage', icon: 'sparkles', color: '#0E7490', bg: '#E0F2FE',
      title: t.directory.catHeritage, desc: t.directory.catHeritageDesc },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="directory-screen">
      <View style={styles.header}>
        <Text style={styles.kicker}>EFYL</Text>
        <Text style={styles.title}>{t.directory.title}</Text>
        <Text style={styles.subtitle}>{t.directory.subtitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {!!total && (
          <View style={styles.totalBanner} testID="directory-total">
            <Ionicons name="albums-outline" size={16} color={Colors.primary} />
            <Text style={styles.totalTxt}>
              <Text style={styles.totalNum}>{total}</Text> {t.directory.totalLabel}
            </Text>
          </View>
        )}

        {failed && (
          <View style={styles.offlineCard} testID="directory-offline">
            <Ionicons name="cloud-offline-outline" size={20} color={Colors.gpsYellow} />
            <Text style={styles.offlineTxt}>{t.directory.offlineNotice}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load} testID="directory-retry">
              <Text style={styles.retryTxt}>{t.directory.retry}</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && !counts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTxt}>{t.directory.loading}</Text>
          </View>
        ) : (
          cats.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/directory/list/${c.key}`)}
              testID={`directory-cat-${c.key}`}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={26} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardDesc}>{c.desc}</Text>
              </View>
              <View style={styles.countCol}>
                <Text style={[styles.countNum, { color: c.color }]}>
                  {counts ? counts[c.key] ?? 0 : '—'}
                </Text>
                <Text style={styles.countLbl}>{t.directory.entriesLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}

        {!isOnline && !failed && (
          <Text style={styles.hint}>ℹ️ {t.directory.offlineNotice}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  kicker: { fontFamily: 'DMSans_700Bold', fontSize: 12, letterSpacing: 2, color: Colors.accent, marginBottom: 4 },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 2 },
  totalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E7F3EC', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.md,
  },
  totalTxt: { ...Typography.bodySm, color: Colors.primary, flex: 1 },
  totalNum: { fontFamily: 'JetBrainsMono_700Bold' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.divider, ...Shadows.card,
  },
  iconWrap: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.h3, fontSize: 17 },
  cardDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  countCol: { alignItems: 'center', minWidth: 52 },
  countNum: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18 },
  countLbl: { ...Typography.caption, fontSize: 10, color: Colors.textTertiary },
  loadingBox: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: 10 },
  loadingTxt: { ...Typography.bodySm, color: Colors.textSecondary },
  offlineCard: {
    backgroundColor: Colors.pillYellowBg, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'center', gap: 8,
  },
  offlineTxt: { ...Typography.bodySm, color: Colors.gpsYellow, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
  },
  retryTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  hint: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.md },
});
