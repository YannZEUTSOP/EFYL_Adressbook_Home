import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { LeafletMap, LeafletPin } from '../../src/components/LeafletMap';
import { Pill } from '../../src/components/Pill';

export default function MapTab() {
  const { t, addresses, publicCommerces, refreshAddresses, refreshPublicCommerces, isOnline } = useApp();
  const router = useRouter();
  const [satellite, setSatellite] = useState(false);
  const [showCommunity, setShowCommunity] = useState(true);

  useFocusEffect(React.useCallback(() => {
    refreshAddresses();
    refreshPublicCommerces();
  }, [refreshAddresses, refreshPublicCommerces]));

  const pins: LeafletPin[] = useMemo(() => {
    const mine = addresses.map((a) => ({
      id: a.address_id,
      lat: a.latitude,
      lng: a.longitude,
      color:
        a.flag_count >= 3 ? '#EF4444' :
        a.is_heritage ? '#DB2777' :
        a.is_public ? '#8B5CF6' :
        a.is_commerce ? '#F97316' :
        a.low_accuracy ? '#9CA3AF' :
        a.verified ? '#22C55E' : '#F59E0B',
      title: `${a.is_heritage ? '🏞️ ' : a.is_public ? '🏛️ ' : a.is_commerce ? '🏪 ' : ''}${a.contact_name || a.district} — ${a.address_id}`,
    }));
    if (!showCommunity) return mine;
    const community = publicCommerces.map((a) => ({
      id: a.address_id,
      lat: a.latitude,
      lng: a.longitude,
      color: a.is_heritage ? '#DB2777' : a.is_public ? '#8B5CF6' : '#F97316',
      title: `${a.is_heritage ? '🏞️' : a.is_public ? '🏛️' : '🏪'} ${a.contact_name || a.district} — ${a.address_id}`,
    }));
    // Filter community pins that already exist in mine
    const mineIds = new Set(mine.map((p) => p.id));
    return [...mine, ...community.filter((p) => !mineIds.has(p.id))];
  }, [addresses, publicCommerces, showCommunity]);

  const { centerLat, centerLng, zoom } = useMemo(() => {
    const all = [...addresses, ...(showCommunity ? publicCommerces : [])];
    if (!all.length) return { centerLat: 4.0951, centerLng: 9.7679, zoom: 13 };
    const lats = all.map((a) => a.latitude);
    const lngs = all.map((a) => a.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const spread = Math.max(maxLat - minLat, maxLng - minLng);
    const zoom = spread < 0.01 ? 16 : spread < 0.1 ? 13 : spread < 1 ? 10 : 6;
    return { centerLat, centerLng, zoom };
  }, [addresses, publicCommerces, showCommunity]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="map-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.map.title}</Text>
          <Text style={styles.subtitle}>
            {addresses.length} {t.map.myAddresses}
            {showCommunity && publicCommerces.length > 0 ? ` • ${publicCommerces.length} 🏪` : ''}
          </Text>
        </View>
        <View style={styles.layerToggle}>
          <TouchableOpacity
            onPress={() => setSatellite(false)}
            style={[styles.layerChip, !satellite && styles.layerActive]}
            testID="map-streets-btn"
          >
            <Ionicons name="map-outline" size={14} color={!satellite ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.layerTxt, !satellite && styles.layerTxtActive]}>{t.map.streets}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSatellite(true)}
            style={[styles.layerChip, satellite && styles.layerActive]}
            testID="map-sat-btn"
          >
            <Ionicons name="globe-outline" size={14} color={satellite ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.layerTxt, satellite && styles.layerTxtActive]}>{t.map.sat}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.communityToggle, showCommunity && styles.communityToggleActive]}
          onPress={() => setShowCommunity((v) => !v)}
          testID="map-community-toggle"
        >
          <Ionicons name="storefront" size={14} color={showCommunity ? Colors.white : Colors.accent} />
          <Text style={[styles.communityToggleTxt, showCommunity && styles.communityToggleTxtActive]}>
            {t.home.communityCommerces} ({publicCommerces.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.offlineMapsBtn}
          onPress={() => router.push('/offline-maps')}
          testID="map-offline-maps-btn"
        >
          <Ionicons name="download-outline" size={14} color={Colors.primary} />
          <Text style={styles.offlineMapsBtnTxt}>{t.map.offlineMapsBtn}</Text>
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner} testID="map-offline-banner">
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.white} />
          <Text style={styles.offlineBannerTxt}>{t.map.offline}</Text>
        </View>
      )}

      <View style={styles.mapBox} testID="real-map">
        <LeafletMap
          centerLat={centerLat}
          centerLng={centerLng}
          zoom={zoom}
          pins={pins}
          satellite={satellite}
          offlineMode={!isOnline}
          onPinTap={(id) => router.push(`/address/${encodeURIComponent(id)}`)}
          style={{ height: '100%' }}
        />
      </View>

      <Text style={styles.listTitle}>{t.map.myAddresses}</Text>
      <FlatList
        data={addresses.slice(0, 50)}
        keyExtractor={(it) => it.address_id}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const variant = item.accuracy_meters <= 1.0 ? 'green' : item.accuracy_meters <= 3.0 ? 'yellow' : 'red';
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/address/${encodeURIComponent(item.address_id)}`)}
              testID={`map-list-${item.address_id}`}
            >
              <Ionicons name="location" size={20} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.rowName}>{item.contact_name || item.district}</Text>
                <Text style={styles.rowCode}>{item.address_id}</Text>
              </View>
              <Pill variant={variant} label={`${item.accuracy_meters.toFixed(1)}m`} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 2 },
  layerToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.pill, padding: 3 },
  layerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  layerActive: { backgroundColor: Colors.primary },
  layerTxt: { ...Typography.caption, color: Colors.textSecondary, fontFamily: 'DMSans_500Medium' },
  layerTxtActive: { color: Colors.white },
  chipsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
  },
  communityToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  communityToggleActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  communityToggleTxt: { ...Typography.caption, color: Colors.accent, fontFamily: 'DMSans_700Bold' },
  communityToggleTxtActive: { color: Colors.white },
  offlineMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  offlineMapsBtnTxt: { ...Typography.caption, color: Colors.primary, fontFamily: 'DMSans_700Bold' },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.textSecondary,
  },
  offlineBannerTxt: { ...Typography.caption, color: Colors.white, fontFamily: 'DMSans_700Bold' },
  mapBox: { margin: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden', height: 320, ...Shadows.card, backgroundColor: '#E7EFE7' },
  listTitle: { ...Typography.h3, paddingHorizontal: Spacing.lg, marginVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: 10, ...Shadows.card },
  rowName: { ...Typography.label, color: Colors.textPrimary },
  rowCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: Colors.primary, marginTop: 2 },
});
