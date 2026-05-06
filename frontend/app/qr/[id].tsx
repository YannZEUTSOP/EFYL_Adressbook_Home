import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import type { AddressDTO } from '../../src/services/api';
import { Storage } from '../../src/services/storage';
import { buildQRPayload, shareMessageFor, formatAddressDisplay } from '../../src/utils/address';
import { Button } from '../../src/components/Button';

export default function QRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, language } = useApp();
  const [addr, setAddr] = useState<AddressDTO | null>(null);

  useEffect(() => {
    (async () => {
      const list = await Storage.getAddresses();
      const found = list.find((a) => a.address_id === decodeURIComponent(String(id)));
      setAddr(found || null);
    })();
  }, [id]);

  if (!addr) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>—</Text>
      </SafeAreaView>
    );
  }

  const payload = buildQRPayload(addr);
  const message = shareMessageFor(addr.contact_name || addr.district, addr.address_id, language);

  const onShare = async () => {
    try {
      await Share.share({ message }, { dialogTitle: t.qr.title });
    } catch (e) {
      // ignore
    }
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(message);
    if (Platform.OS === 'web') alert(t.qr.copied);
    else Alert.alert(t.qr.copied);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="qr-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="qr-back-btn">
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.qr.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.qrCard} testID="qr-card">
        <Text style={styles.contact}>{addr.contact_name || addr.district}</Text>
        <View style={styles.qrBox}>
          <QRCode value={payload} size={240} color={Colors.primary} backgroundColor={Colors.white} />
        </View>
        <Text style={styles.code} testID="qr-address-code">{addr.address_id}</Text>
        <Text style={styles.metaLine}>{formatAddressDisplay(addr.district, addr.sector, addr.street_id, addr.house_number)}</Text>
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
        <Button label={`💬  ${t.qr.shareWa}`} variant="primary" onPress={onShare} testID="share-whatsapp-btn" />
        <Button label={t.qr.shareGeneric} variant="secondary" onPress={onShare} testID="share-generic-btn" />
        <Button label="📋  Copy" variant="ghost" onPress={onCopy} testID="copy-btn" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  qrCard: {
    margin: Spacing.lg, padding: Spacing.xl,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    alignItems: 'center', ...Shadows.card,
  },
  contact: { ...Typography.h3, marginBottom: Spacing.md },
  qrBox: {
    padding: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: Colors.divider,
  },
  code: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: 1.5, marginTop: Spacing.lg },
  metaLine: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 6 },
});
