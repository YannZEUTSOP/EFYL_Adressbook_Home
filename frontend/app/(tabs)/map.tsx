import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Pill } from '../../src/components/Pill';

export default function MapTab() {
  const { t, addresses } = useApp();
  const router = useRouter();

  // Compute simple bounds for visualization
  const items = useMemo(() => addresses.slice(0, 30), [addresses]);
  const bounds = useMemo(() => {
    if (!items.length) return { minLat: 4.05, maxLat: 4.13, minLng: 9.72, maxLng: 9.82 };
    const lats = items.map((a) => a.latitude);
    const lngs = items.map((a) => a.longitude);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    if (maxLat - minLat < 0.005) { minLat -= 0.003; maxLat += 0.003; }
    if (maxLng - minLng < 0.005) { minLng -= 0.003; maxLng += 0.003; }
    return { minLat, maxLat, minLng, maxLng };
  }, [items]);

  const project = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    return { x, y };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="map-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t.map.title}</Text>
        <Text style={styles.subtitle}>{addresses.length} {t.map.myAddresses}</Text>
      </View>

      <View style={styles.mapWrap} testID="map-canvas">
        <View style={styles.mapBg}>
          {/* faux map grid */}
          {[...Array(8)].map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLine, { top: `${(i + 1) * 11}%`, width: '100%', height: 1 }]} />
          ))}
          {[...Array(8)].map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLine, { left: `${(i + 1) * 11}%`, width: 1, height: '100%' }]} />
          ))}
          {items.map((a) => {
            const { x, y } = project(a.latitude, a.longitude);
            const color = a.flag_count >= 3 ? Colors.error : a.verified ? Colors.success : Colors.warning;
            return (
              <TouchableOpacity
                key={a.address_id}
                onPress={() => router.push(`/address/${encodeURIComponent(a.address_id)}`)}
                style={[styles.pin, { left: `${x}%`, top: `${y}%`, backgroundColor: color }]}
                testID={`pin-${a.address_id}`}
              >
                <Ionicons name="location" size={14} color={Colors.white} />
              </TouchableOpacity>
            );
          })}
          {!items.length && (
            <View style={styles.mapEmpty}>
              <Ionicons name="map-outline" size={56} color={Colors.textTertiary} />
              <Text style={styles.mapEmptyTxt}>Aucune adresse à afficher</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.listTitle}>{t.map.myAddresses}</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.address_id}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
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
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 2 },
  mapWrap: { margin: Spacing.lg, borderRadius: Radius.xl, overflow: 'hidden', height: 260, ...Shadows.card },
  mapBg: { flex: 1, backgroundColor: '#E7EFE7', position: 'relative' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(13,92,58,0.06)' },
  pin: { position: 'absolute', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white, transform: [{ translateX: -12 }, { translateY: -12 }], ...Shadows.card },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapEmptyTxt: { ...Typography.body, color: Colors.textSecondary },
  listTitle: { ...Typography.h3, paddingHorizontal: Spacing.lg, marginTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: 10, ...Shadows.card },
  rowName: { ...Typography.label, color: Colors.textPrimary },
  rowCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: Colors.primary, marginTop: 2 },
});
