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
  const { t, addresses, refreshAddresses } = useApp();
  const router = useRouter();
  const [satellite, setSatellite] = useState(false);

  useFocusEffect(React.useCallback(() => { refreshAddresses(); }, [refreshAddresses]));

  const pins: LeafletPin[] = useMemo(
    () =>
      addresses.map((a) => ({
        id: a.address_id,
        lat: a.latitude,
        lng: a.longitude,
        color:
          a.flag_count >= 3 ? '#EF4444' :
          a.low_accuracy ? '#9CA3AF' :
          a.verified ? '#22C55E' : '#F59E0B',
        title: `${a.contact_name || a.district} — ${a.address_id}`,
      })),
    [addresses]
  );

  const { centerLat, centerLng, zoom } = useMemo(() => {
    if (!addresses.length) return { centerLat: 4.0951, centerLng: 9.7679, zoom: 13 };
    const lats = addresses.map((a) => a.latitude);
    const lngs = addresses.map((a) => a.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const spread = Math.max(maxLat - minLat, maxLng - minLng);
    const zoom = spread < 0.01 ? 16 : spread < 0.1 ? 13 : spread < 1 ? 10 : 6;
    return { centerLat, centerLng, zoom };
  }, [addresses]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="map-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.map.title}</Text>
          <Text style={styles.subtitle}>{addresses.length} {t.map.myAddresses}</Text>
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

      <View style={styles.mapBox} testID="real-map">
        <LeafletMap
          centerLat={centerLat}
          centerLng={centerLng}
          zoom={zoom}
          pins={pins}
          satellite={satellite}
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
  mapBox: { margin: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden', height: 320, ...Shadows.card, backgroundColor: '#E7EFE7' },
  listTitle: { ...Typography.h3, paddingHorizontal: Spacing.lg, marginVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: 10, ...Shadows.card },
  rowName: { ...Typography.label, color: Colors.textPrimary },
  rowCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: Colors.primary, marginTop: 2 },
});
