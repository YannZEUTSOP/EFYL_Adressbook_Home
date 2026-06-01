import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/contexts/AppContext';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { AddressCard } from '../../src/components/AddressCard';
import type { AddressDTO } from '../../src/services/api';

const EMPTY_IMG =
  'https://static.prod-images.emergentagent.com/jobs/01bc7a24-6841-47ee-8fcc-c01d9b3ffb38/images/ec63c662bb5979c2b36aa637cea40952552492b39b8653a35cea9e8b5623f62a.png';

type Row = { kind: 'header'; label: string; count: number } | { kind: 'item'; addr: AddressDTO; isPublic?: boolean };

export default function HomeTab() {
  const router = useRouter();
  const { t, addresses, publicCommerces, refreshAddresses, refreshPublicCommerces, isOnline } = useApp();
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refreshAddresses();
      refreshPublicCommerces();
    }, [refreshAddresses, refreshPublicCommerces])
  );

  const matches = (a: AddressDTO, s: string) =>
    a.contact_name?.toLowerCase().includes(s) ||
    a.address_id.toLowerCase().includes(s) ||
    a.district.toLowerCase().includes(s);

  const { mine, commerces } = useMemo(() => {
    const s = q.trim().toLowerCase();
    const mine = s ? addresses.filter((a) => matches(a, s)) : addresses;
    const commerces = s ? publicCommerces.filter((a) => matches(a, s)) : publicCommerces;
    return { mine, commerces };
  }, [addresses, publicCommerces, q]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    out.push({ kind: 'header', label: t.home.myAddresses, count: mine.length });
    mine.forEach((addr) => out.push({ kind: 'item', addr }));
    if (commerces.length > 0 || isOnline) {
      out.push({ kind: 'header', label: t.home.communityCommerces, count: commerces.length });
      commerces.forEach((addr) => out.push({ kind: 'item', addr, isPublic: true }));
    }
    return out;
  }, [mine, commerces, t.home.myAddresses, t.home.communityCommerces, isOnline]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAddresses(), refreshPublicCommerces()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="home-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>EFYL</Text>
          <Text style={styles.title}>{t.home.title}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/profile')} testID="profile-shortcut-btn">
          <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.gpsYellow} />
          <Text style={styles.offlineText}>{t.home.offline}</Text>
        </View>
      )}

      <View style={styles.searchBox} testID="search-box">
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          placeholder={t.home.search}
          placeholderTextColor={Colors.textTertiary}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={addresses.length === 0 && commerces.length === 0 ? [] : rows}
        keyExtractor={(it, i) => (it.kind === 'header' ? `h-${i}` : `i-${it.addr.address_id}-${i}`)}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={styles.sectionHeader} testID={`section-${item.label}`}>
                <Text style={styles.sectionTitle}>{item.label}</Text>
                <View style={styles.sectionPill}>
                  <Text style={styles.sectionPillTxt}>{item.count}</Text>
                </View>
              </View>
            );
          }
          return (
            <View>
              <AddressCard
                addr={item.addr}
                onPress={() => router.push(`/address/${encodeURIComponent(item.addr.address_id)}`)}
                testID={`address-card-${item.addr.address_id}`}
              />
              {item.isPublic && (
                <View style={styles.publicTag}>
                  <Ionicons name="earth" size={10} color={Colors.white} />
                  <Text style={styles.publicTagTxt}>{t.home.publicBadge}</Text>
                </View>
              )}
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="empty-state">
            <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} resizeMode="cover" />
            <Text style={styles.emptyTitle}>{t.home.empty}</Text>
            <Text style={styles.emptyBody}>{t.home.emptyCta}</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-address')}
        activeOpacity={0.85}
        testID="new-address-fab"
      >
        <Ionicons name="add" size={28} color={Colors.white} />
        <Text style={styles.fabLabel}>{t.home.newAddress}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  kicker: { fontFamily: 'DMSans_700Bold', fontSize: 12, letterSpacing: 2, color: Colors.accent, marginBottom: 4 },
  title: { ...Typography.h1 },
  iconBtn: { padding: 4 },
  offlineBanner: {
    backgroundColor: Colors.pillYellowBg,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.md,
    flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: Spacing.sm,
  },
  offlineText: { ...Typography.bodySm, color: Colors.gpsYellow, fontFamily: 'DMSans_500Medium' },
  searchBox: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 48,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.divider,
  },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary, height: '100%' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingTop: Spacing.md,
  },
  sectionTitle: { ...Typography.h3, fontSize: 16, color: Colors.textPrimary },
  sectionPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill,
  },
  sectionPillTxt: { ...Typography.caption, color: Colors.textSecondary, fontFamily: 'DMSans_700Bold' },
  publicTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: -Spacing.sm - 2, marginLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  publicTagTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: Spacing.xl },
  emptyImg: { width: 240, height: 200, borderRadius: Radius.xl, marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.h2, fontSize: 20, textAlign: 'center', marginBottom: Spacing.xs },
  emptyBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
  fab: {
    position: 'absolute', bottom: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg, height: 56, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    ...Shadows.fab,
  },
  fabLabel: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 14 },
});
