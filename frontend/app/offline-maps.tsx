import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import {
  OfflineRegion, PRESET_CITIES, RADIUS_OPTIONS,
  countTiles, estimateSizeMB, getRegions, downloadRegion, deleteRegion,
  totalSizeBytes, isOfflineMapsSupported,
} from '../src/services/offlineTiles';

type Target = { name: string; lat: number; lng: number };

export default function OfflineMapsScreen() {
  const { t, isOnline } = useApp();
  const router = useRouter();

  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const [selCity, setSelCity] = useState<number | 'gps' | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [downloading, setDownloading] = useState<{ name: string; done: number; total: number } | null>(null);
  const cancelRef = useRef(false);

  const refresh = useCallback(async () => {
    setRegions(await getRegions());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const target: Target | null = useMemo(() => {
    if (selCity === 'gps') {
      return gpsCoords ? { name: t.offlineMaps.myPosition, ...gpsCoords } : null;
    }
    if (typeof selCity === 'number') return PRESET_CITIES[selCity];
    return null;
  }, [selCity, gpsCoords, t.offlineMaps.myPosition]);

  const estimate = useMemo(() => {
    if (!target) return null;
    const n = countTiles(target.lat, target.lng, radiusKm);
    return { tiles: n, mb: estimateSizeMB(n) };
  }, [target, radiusKm]);

  const pickGps = async () => {
    setSelCity('gps');
    if (gpsCoords) return;
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert(t.offlineMaps.gpsError);
      setSelCity(null);
    } finally {
      setGpsLoading(false);
    }
  };

  const startDownload = async (tgt: Target, radius: number) => {
    if (downloading) return;
    cancelRef.current = false;
    const total = countTiles(tgt.lat, tgt.lng, radius);
    setDownloading({ name: tgt.name, done: 0, total });
    try {
      const region = await downloadRegion(
        { name: tgt.name, lat: tgt.lat, lng: tgt.lng, radiusKm: radius },
        (done, tot) => setDownloading({ name: tgt.name, done, total: tot }),
        () => cancelRef.current,
      );
      await refresh();
      Alert.alert(
        region.status === 'complete' ? t.offlineMaps.downloadDone : t.offlineMaps.downloadPartial,
      );
    } catch {
      await refresh();
      Alert.alert(t.offlineMaps.downloadPartial);
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = (region: OfflineRegion) => {
    Alert.alert(t.offlineMaps.deleteConfirm, t.offlineMaps.deleteMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.ok,
        style: 'destructive',
        onPress: async () => {
          await deleteRegion(region.id);
          await refresh();
        },
      },
    ]);
  };

  const totalMB = totalSizeBytes(regions) / (1024 * 1024);
  const canDownload = !!target && isOnline && !downloading && isOfflineMapsSupported && !gpsLoading;
  const pct = downloading && downloading.total > 0 ? Math.round((downloading.done / downloading.total) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="offline-maps-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="offline-maps-back">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.offlineMaps.title}</Text>
          <Text style={styles.subtitle}>{t.offlineMaps.subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Hint */}
        <View style={styles.hintCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.hintTxt}>{t.offlineMaps.offlineHint}</Text>
        </View>

        {!isOfflineMapsSupported && (
          <View style={styles.warnCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
            <Text style={styles.warnTxt}>{t.offlineMaps.webNotSupported}</Text>
          </View>
        )}

        {/* Downloaded regions */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t.offlineMaps.downloadedZones}</Text>
          {regions.length > 0 && (
            <Text style={styles.storageTxt}>
              {t.offlineMaps.storageUsed}: {totalMB.toFixed(1)} Mo
            </Text>
          )}
        </View>

        {regions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="map-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTxt}>{t.offlineMaps.noZones}</Text>
          </View>
        ) : (
          regions.map((r) => (
            <View key={r.id} style={styles.regionCard} testID={`region-${r.id}`}>
              <View style={styles.regionIcon}>
                <Ionicons name="map" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionName}>{r.name}</Text>
                <Text style={styles.regionMeta}>
                  {r.radiusKm} km • {(r.sizeBytes / (1024 * 1024)).toFixed(1)} Mo • {new Date(r.createdAt).toLocaleDateString()}
                </Text>
                <View style={styles.regionStatusRow}>
                  <View style={[styles.statusPill, r.status === 'complete' ? styles.statusOk : styles.statusPartial]}>
                    <Ionicons
                      name={r.status === 'complete' ? 'checkmark-circle' : 'alert-circle'}
                      size={12}
                      color={r.status === 'complete' ? Colors.gpsGreen : Colors.gpsYellow}
                    />
                    <Text style={[styles.statusTxt, { color: r.status === 'complete' ? Colors.gpsGreen : Colors.gpsYellow }]}>
                      {r.status === 'complete' ? t.offlineMaps.complete : t.offlineMaps.partial}
                      {r.status !== 'complete' ? ` (${r.downloadedCount}/${r.tileCount})` : ''}
                    </Text>
                  </View>
                  {r.status !== 'complete' && isOnline && !downloading && (
                    <TouchableOpacity
                      style={styles.resumeBtn}
                      onPress={() => startDownload({ name: r.name, lat: r.lat, lng: r.lng }, r.radiusKm)}
                      testID={`region-resume-${r.id}`}
                    >
                      <Ionicons name="download-outline" size={12} color={Colors.white} />
                      <Text style={styles.resumeTxt}>{t.offlineMaps.resume}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => confirmDelete(r)}
                style={styles.deleteBtn}
                disabled={!!downloading}
                testID={`region-delete-${r.id}`}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Add new zone */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{t.offlineMaps.addZone}</Text>

        {!isOnline && (
          <View style={styles.warnCard}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.warning} />
            <Text style={styles.warnTxt}>{t.offlineMaps.needOnline}</Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>{t.offlineMaps.chooseCity}</Text>
        <View style={styles.chipsWrap}>
          <TouchableOpacity
            style={[styles.cityChip, styles.gpsChip, selCity === 'gps' && styles.cityChipActive]}
            onPress={pickGps}
            testID="city-gps"
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={selCity === 'gps' ? Colors.white : Colors.primary} />
            ) : (
              <Ionicons name="navigate" size={13} color={selCity === 'gps' ? Colors.white : Colors.primary} />
            )}
            <Text style={[styles.cityChipTxt, selCity === 'gps' && styles.cityChipTxtActive]}>
              {t.offlineMaps.myPosition}
            </Text>
          </TouchableOpacity>
          {PRESET_CITIES.map((c, i) => (
            <TouchableOpacity
              key={c.name}
              style={[styles.cityChip, selCity === i && styles.cityChipActive]}
              onPress={() => setSelCity(i)}
              testID={`city-${c.name}`}
            >
              <Text style={[styles.cityChipTxt, selCity === i && styles.cityChipTxtActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t.offlineMaps.radius}</Text>
        <View style={styles.chipsWrap}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, radiusKm === r && styles.cityChipActive]}
              onPress={() => setRadiusKm(r)}
              testID={`radius-${r}`}
            >
              <Text style={[styles.cityChipTxt, radiusKm === r && styles.cityChipTxtActive]}>{r} km</Text>
            </TouchableOpacity>
          ))}
        </View>

        {estimate && !downloading && (
          <View style={styles.estimateBox} testID="download-estimate">
            <Ionicons name="cloud-download-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.estimateTxt}>
              {t.offlineMaps.estimate}: ~{estimate.mb.toFixed(1)} Mo ({estimate.tiles} {t.offlineMaps.tiles})
            </Text>
          </View>
        )}

        {downloading ? (
          <View style={styles.progressCard} testID="download-progress">
            <Text style={styles.progressTitle}>
              {t.offlineMaps.downloading} {downloading.name}
            </Text>
            <View style={styles.progressBarOuter}>
              <View style={[styles.progressBarInner, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressMeta}>
              {downloading.done} / {downloading.total} {t.offlineMaps.tiles} — {pct}%
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { cancelRef.current = true; }}
              testID="download-cancel"
            >
              <Text style={styles.cancelTxt}>{t.offlineMaps.cancelDownload}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.downloadBtn, !canDownload && styles.downloadBtnDisabled]}
            disabled={!canDownload}
            onPress={() => target && startDownload(target, radiusKm)}
            testID="download-start"
          >
            <Ionicons name="download" size={18} color={Colors.white} />
            <Text style={styles.downloadTxt}>{t.offlineMaps.download}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  title: { ...Typography.h2 },
  subtitle: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 2 },
  hintCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#E8F3ED', borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    padding: Spacing.md,
  },
  hintTxt: { ...Typography.bodySm, color: Colors.primary, flex: 1, lineHeight: 19 },
  warnCard: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: Colors.pillYellowBg, borderRadius: Radius.md,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  warnTxt: { ...Typography.caption, color: '#92600A', flex: 1 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h3, paddingHorizontal: 0, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  storageTxt: { ...Typography.caption, color: Colors.textSecondary },
  emptyBox: {
    alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, padding: Spacing.lg, ...Shadows.card,
  },
  emptyTxt: { ...Typography.bodySm, color: Colors.textTertiary },
  regionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginBottom: 10,
    padding: Spacing.md, ...Shadows.card,
  },
  regionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F3ED', alignItems: 'center', justifyContent: 'center',
  },
  regionName: { ...Typography.label, color: Colors.textPrimary },
  regionMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  regionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
  },
  statusOk: { backgroundColor: Colors.pillGreenBg },
  statusPartial: { backgroundColor: Colors.pillYellowBg },
  statusTxt: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  resumeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  resumeTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 11 },
  deleteBtn: { padding: 8 },
  fieldLabel: {
    ...Typography.label, color: Colors.textSecondary,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: Spacing.lg,
  },
  cityChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  gpsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: Colors.primary },
  cityChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cityChipTxt: { ...Typography.bodySm, color: Colors.textPrimary, fontFamily: 'DMSans_500Medium' },
  cityChipTxtActive: { color: Colors.white },
  radiusChip: {
    paddingHorizontal: 22, paddingVertical: 8,
    borderRadius: Radius.pill, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  estimateBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  estimateTxt: { ...Typography.bodySm, color: Colors.textSecondary },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    paddingVertical: 15,
  },
  downloadBtnDisabled: { opacity: 0.4 },
  downloadTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 16 },
  progressCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    padding: Spacing.md, ...Shadows.card,
  },
  progressTitle: { ...Typography.label, color: Colors.textPrimary },
  progressBarOuter: {
    height: 10, borderRadius: 5, backgroundColor: Colors.surface,
    marginTop: 10, overflow: 'hidden',
  },
  progressBarInner: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
  progressMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 6 },
  cancelBtn: {
    alignSelf: 'center', marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
  },
  cancelTxt: { ...Typography.bodySm, color: Colors.error, fontFamily: 'DMSans_700Bold' },
});
