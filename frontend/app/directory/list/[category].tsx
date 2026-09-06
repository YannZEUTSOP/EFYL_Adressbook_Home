// Registry of one category — searchable by name, matricule, address code.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../src/theme';
import { useApp } from '../../../src/contexts/AppContext';
import { Api } from '../../../src/services/api';
import type { DirectoryCategory, DirectoryEntry } from '../../../src/services/api';

const PAGE = 40;

type Sort = 'name' | 'near' | 'recent';

export default function DirectoryList() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = (['household', 'commerce', 'public', 'heritage'].includes(String(category))
    ? String(category)
    : 'household') as DirectoryCategory;
  const { t } = useApp();

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  const meta: Record<DirectoryCategory, { title: string; icon: any; color: string }> = {
    household: { title: t.directory.catHousehold, icon: 'home', color: Colors.primary },
    commerce: { title: t.directory.catCommerce, icon: 'storefront', color: Colors.accent },
    public: { title: t.directory.catPublic, icon: 'business', color: '#7C3AED' },
    heritage: { title: t.directory.catHeritage, icon: 'sparkles', color: '#0E7490' },
  };

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  const fetchPage = useCallback(async (offset: number) => {
    const mine = ++reqId.current;
    try {
      const r = await Api.directoryEntries({
        category: cat, q: debounced || undefined, limit: PAGE, offset,
        sort, lat: coords?.lat, lng: coords?.lng,
      });
      if (mine !== reqId.current) return;
      setTotal(r.total);
      setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
      setFailed(false);
    } catch {
      if (mine === reqId.current) setFailed(true);
    }
  }, [cat, debounced, sort, coords]);

  useEffect(() => {
    setLoading(true);
    fetchPage(0).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore || loading || items.length >= total) return;
    setLoadingMore(true);
    await fetchPage(items.length);
    setLoadingMore(false);
  };

  const useMyPosition = async () => {
    // Permission asked only now — the user just tapped "nearest" (clear intent)
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) {
      const msg = t.directory.locDenied;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(msg, '', [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.directory.openSettings, onPress: () => Linking.openSettings() },
        ]);
      }
      return;
    }
    const pos =
      (await Location.getLastKnownPositionAsync()) ||
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setSort('near');
  };

  const renderRow = ({ item }: { item: DirectoryEntry }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={() => router.push(`/directory/fiche/${encodeURIComponent(item.key)}`)}
      testID={`dir-row-${item.key}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${meta[cat].color}18` }]}>
        <Ionicons name={meta[cat].icon} size={18} color={meta[cat].color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.rowMetaLine}>
          <Text style={styles.rowCode}>{item.address_id}</Text>
          {item.verified && <Ionicons name="checkmark-circle" size={12} color={Colors.success} />}
        </View>
        <Text style={styles.rowPlace} numberOfLines={1}>
          {item.district}{item.sector ? ` • ${item.sector}` : ''}
          {item.house_number ? ` • n°${item.house_number}` : ''}
        </Text>
        {item.shared_code && !!item.surveyor && (
          <Text style={styles.rowSurveyor} numberOfLines={1}>
            🔁 {t.directory.surveyedBy} {item.surveyor} • {new Date(item.created_at).toLocaleDateString()}
          </Text>
        )}
        <View style={styles.tagsLine}>
          {item.matricule ? (
            <View style={styles.matPill}>
              <Text style={styles.matTxt}>{item.matricule}</Text>
            </View>
          ) : null}
          {item.nav_source === 'nav_point' && (
            <View style={styles.navPill}>
              <Ionicons name="locate" size={9} color={Colors.white} />
              <Text style={styles.navTxt}>GPS+</Text>
            </View>
          )}
          {typeof item.distance_m === 'number' && (
            <Text style={styles.dist}>
              {item.distance_m > 1500 ? `${(item.distance_m / 1000).toFixed(1)} km` : `${item.distance_m} m`}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="directory-list-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="dir-back-btn" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meta[cat].title}</Text>
          <Text style={styles.subtitle} testID="dir-count">
            {total} {t.directory.resultsCount}
          </Text>
        </View>
        <Ionicons name={meta[cat].icon} size={24} color={meta[cat].color} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder={t.directory.searchPh}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="search"
          testID="dir-search-input"
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ('')} testID="dir-search-clear">
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortRow}>
        <Chip label={t.directory.sortName} active={sort === 'name'} onPress={() => setSort('name')} testID="dir-sort-name" />
        <Chip label={t.directory.sortNear} active={sort === 'near'} onPress={useMyPosition} testID="dir-sort-near" />
        <Chip label={t.directory.sortRecent} active={sort === 'recent'} onPress={() => setSort('recent')} testID="dir-sort-recent" />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerTxt}>{t.directory.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center} testID="dir-empty">
              <Ionicons
                name={failed ? 'cloud-offline-outline' : 'search-outline'}
                size={40}
                color={Colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>
                {failed ? t.directory.offlineNotice : t.directory.noResults}
              </Text>
              {!failed && <Text style={styles.centerTxt}>{t.directory.noResultsHint}</Text>}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void; testID?: string }> = ({
  label, active, onPress, testID,
}) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    testID={testID}
    activeOpacity={0.85}
  >
    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  title: { ...Typography.h2, fontSize: 20 },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  searchBox: {
    backgroundColor: Colors.card, marginHorizontal: Spacing.lg,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 48,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.divider, ...Shadows.card,
  },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: Colors.textPrimary, height: '100%',
  },
  sortRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.divider,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Typography.caption, color: Colors.textSecondary, fontFamily: 'DMSans_500Medium' },
  chipTxtActive: { color: Colors.white },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.divider, ...Shadows.card,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowName: { ...Typography.label, fontFamily: 'DMSans_700Bold', fontSize: 15 },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  rowCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: Colors.primary, letterSpacing: 0.6 },
  rowPlace: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  rowSurveyor: { ...Typography.caption, fontSize: 10, color: Colors.gpsYellow, marginTop: 2 },
  tagsLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  matPill: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  matTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: Colors.textPrimary },
  navPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.success, borderRadius: Radius.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  navTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 9 },
  dist: { ...Typography.caption, fontSize: 10, color: Colors.accent, fontFamily: 'DMSans_700Bold' },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl, gap: 8, paddingHorizontal: Spacing.lg },
  centerTxt: { ...Typography.bodySm, color: Colors.textSecondary, textAlign: 'center' },
  emptyTitle: { ...Typography.h3, fontSize: 16, textAlign: 'center' },
});
