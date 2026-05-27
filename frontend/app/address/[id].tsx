import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share, Linking, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Storage } from '../../src/services/storage';
import type { AddressDTO } from '../../src/services/api';
import { Pill } from '../../src/components/Pill';
import { LeafletMap } from '../../src/components/LeafletMap';
import { formatAddressDisplay, shareMessageFor } from '../../src/utils/address';

function compassLabel(deg: number): string {
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

export default function AddressDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language, deleteAddress } = useApp();
  const [addr, setAddr] = useState<AddressDTO | null>(null);

  useEffect(() => {
    (async () => {
      const list = await Storage.getAddresses();
      const decoded = decodeURIComponent(String(id));
      setAddr(list.find((a) => a.address_id === decoded) || null);
    })();
  }, [id]);

  if (!addr) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>—</Text>
      </SafeAreaView>
    );
  }

  const status = addr.flag_count >= 3 ? 'flagged' : addr.verified ? 'verified' : 'unverified';
  const statusLabel = status === 'verified' ? t.detail.verified : status === 'flagged' ? t.detail.flagged : t.detail.unverified;
  const accVariant = addr.accuracy_meters <= 1.0 ? 'green' : addr.accuracy_meters <= 3.0 ? 'yellow' : 'red';

  const directions = () => {
    const lat = addr.lat_corrected ?? addr.latitude;
    const lng = addr.lng_corrected ?? addr.longitude;
    const url = Platform.select({
      ios: `maps://?ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    })!;
    Linking.openURL(url).catch(() => {});
  };

  const shareIt = async () => {
    try {
      await Share.share({ message: shareMessageFor(addr.contact_name || addr.district, addr.address_id, language) });
    } catch { /* ignore */ }
  };

  const onDelete = () => {
    const doDelete = async () => {
      await deleteAddress(addr.address_id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete?')) doDelete();
    } else {
      Alert.alert('Delete', 'Are you sure?', [
        { text: t.common.cancel, style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const lat = addr.lat_corrected ?? addr.latitude;
  const lng = addr.lng_corrected ?? addr.longitude;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="address-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="detail-back-btn">
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address</Text>
        <TouchableOpacity onPress={onDelete} testID="detail-delete-btn">
          <Ionicons name="trash-outline" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.title}>{addr.contact_name || addr.district}</Text>
        <Text style={styles.code} testID="detail-code">{addr.address_id}</Text>
        <Text style={styles.meta}>{formatAddressDisplay(addr.district, addr.sector, addr.street_id, addr.house_number)}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md, flexWrap: 'wrap' }}>
          <Pill variant={accVariant} label={`${addr.accuracy_meters.toFixed(1)}m`} testID="detail-accuracy" />
          <Pill variant={status === 'verified' ? 'green' : status === 'flagged' ? 'red' : 'yellow'} label={statusLabel} testID="detail-status" />
          {addr.low_accuracy && <Pill variant="red" label={`⚠ ${t.detail.lowAccuracy}`} testID="detail-low" />}
          {addr.has_survey && <Pill variant="green" label="📋 ✓" />}
        </View>

        {/* Mini map */}
        <View style={styles.miniMap}>
          <LeafletMap
            centerLat={lat}
            centerLng={lng}
            zoom={17}
            pins={[{ id: addr.address_id, lat, lng, color: '#0D5C3A' }]}
            style={{ height: '100%' }}
          />
        </View>

        {/* Photo */}
        {addr.photo_base64 && (
          <View style={styles.photoBox}>
            <Text style={styles.sectionLabel}>📸 {t.detail.photoLabel}</Text>
            <Image source={{ uri: `data:image/jpeg;base64,${addr.photo_base64}` }} style={styles.photo} />
          </View>
        )}

        {/* GPS data */}
        <View style={styles.coordsCard}>
          <Text style={styles.coordsLabel}>📍 GPS</Text>
          <Text style={styles.coordsVal}>{addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}</Text>
          {(addr.lat_raw !== null && addr.lat_raw !== undefined && addr.lat_corrected !== null && addr.lat_corrected !== undefined &&
            (addr.lat_raw !== addr.lat_corrected || addr.lng_raw !== addr.lng_corrected)) && (
            <>
              <Text style={styles.coordsLabel}>{t.detail.gpsRaw}</Text>
              <Text style={styles.coordsVal}>{(addr.lat_raw || 0).toFixed(6)}, {(addr.lng_raw || 0).toFixed(6)}</Text>
              <Text style={styles.coordsLabel}>{t.detail.gpsCorrected}</Text>
              <Text style={styles.coordsVal}>{(addr.lat_corrected || 0).toFixed(6)}, {(addr.lng_corrected || 0).toFixed(6)}</Text>
            </>
          )}
          {addr.azimuth_degrees !== null && addr.azimuth_degrees !== undefined && (
            <>
              <Text style={styles.coordsLabel}>🧭 {t.detail.direction}</Text>
              <Text style={styles.coordsVal}>{Math.round(addr.azimuth_degrees)}° {compassLabel(addr.azimuth_degrees)}</Text>
            </>
          )}
          <Text style={styles.coordsLabel}>{t.detail.created}</Text>
          <Text style={styles.coordsVal}>{new Date(addr.created_at).toLocaleString()}</Text>
        </View>

        <View style={styles.actionsGrid}>
          <ActionTile icon="navigate" label={t.detail.directions} onPress={directions} testID="action-directions" />
          <ActionTile icon="share-outline" label={t.detail.share} onPress={shareIt} testID="action-share" />
          <ActionTile icon="qr-code" label={t.detail.qr} onPress={() => router.push(`/qr/${encodeURIComponent(addr.address_id)}`)} testID="action-qr" />
          <ActionTile icon="warning-outline" label={t.detail.report} onPress={() => router.push(`/verify/${encodeURIComponent(addr.address_id)}`)} testID="action-report" />
        </View>

        {/* Survey CTA */}
        <TouchableOpacity
          style={styles.surveyCta}
          onPress={() => router.push(`/survey/${encodeURIComponent(addr.address_id)}`)}
          testID="survey-cta"
        >
          <Ionicons name="document-text-outline" size={22} color={Colors.white} />
          <Text style={styles.surveyCtaTxt}>
            {addr.has_survey ? t.detail.surveyView : t.detail.surveyStart}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const ActionTile: React.FC<{ icon: any; label: string; onPress: () => void; testID?: string }> = ({ icon, label, onPress, testID }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85} testID={testID}>
    <View style={styles.tileIcon}><Ionicons name={icon} size={22} color={Colors.primary} /></View>
    <Text style={styles.tileLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.h3 },
  title: { ...Typography.h1 },
  code: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: 1.5, marginTop: 4 },
  meta: { ...Typography.body, color: Colors.textSecondary, marginTop: 4 },
  miniMap: { height: 180, marginTop: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card },
  photoBox: { marginTop: Spacing.md, backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.lg, ...Shadows.card },
  photo: { width: '100%', height: 200, borderRadius: Radius.md, marginTop: 6, resizeMode: 'cover' },
  sectionLabel: { ...Typography.label, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  coordsCard: { marginTop: Spacing.lg, backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, ...Shadows.card },
  coordsLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: 8 },
  coordsVal: { ...Typography.body, fontFamily: 'JetBrainsMono_700Bold', color: Colors.textPrimary, marginBottom: 2 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.lg },
  tile: { width: '48%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.card },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  tileLabel: { ...Typography.label, color: Colors.textPrimary, textAlign: 'center' },
  surveyCta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: Radius.lg, marginTop: Spacing.md },
  surveyCtaTxt: { flex: 1, color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
