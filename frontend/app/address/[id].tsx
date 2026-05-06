import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Storage } from '../../src/services/storage';
import type { AddressDTO } from '../../src/services/api';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { formatAddressDisplay, shareMessageFor } from '../../src/utils/address';

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
    const url = Platform.select({
      ios: `maps://?ll=${addr.latitude},${addr.longitude}`,
      android: `geo:${addr.latitude},${addr.longitude}?q=${addr.latitude},${addr.longitude}`,
      default: `https://maps.google.com/?q=${addr.latitude},${addr.longitude}`,
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

        <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md }}>
          <Pill variant={accVariant} label={`${addr.accuracy_meters.toFixed(1)}m`} testID="detail-accuracy" />
          <Pill variant={status === 'verified' ? 'green' : status === 'flagged' ? 'red' : 'yellow'} label={statusLabel} testID="detail-status" />
        </View>

        <View style={styles.coordsCard}>
          <Text style={styles.coordsLabel}>📍 GPS</Text>
          <Text style={styles.coordsVal}>{addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}</Text>
          <Text style={styles.coordsLabel}>{t.detail.created}</Text>
          <Text style={styles.coordsVal}>{new Date(addr.created_at).toLocaleString()}</Text>
        </View>

        <View style={styles.actionsGrid}>
          <ActionTile icon="navigate" label={t.detail.directions} onPress={directions} testID="action-directions" />
          <ActionTile icon="share-outline" label={t.detail.share} onPress={shareIt} testID="action-share" />
          <ActionTile icon="qr-code" label={t.detail.qr} onPress={() => router.push(`/qr/${encodeURIComponent(addr.address_id)}`)} testID="action-qr" />
          <ActionTile icon="warning-outline" label={t.detail.report} onPress={() => router.push(`/verify/${encodeURIComponent(addr.address_id)}`)} testID="action-report" />
        </View>
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
  coordsCard: { marginTop: Spacing.lg, backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, ...Shadows.card },
  coordsLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: 4 },
  coordsVal: { ...Typography.body, fontFamily: 'JetBrainsMono_700Bold', color: Colors.textPrimary, marginBottom: 6 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: Spacing.lg },
  tile: { width: '48%', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.card },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  tileLabel: { ...Typography.label, color: Colors.textPrimary, textAlign: 'center' },
});
