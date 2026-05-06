import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { tryDecodeQR } from '../../src/utils/address';
import { Button } from '../../src/components/Button';
import type { AddressDTO } from '../../src/services/api';

let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch { /* ignore */ }
}

export default function ScanScreen() {
  const router = useRouter();
  const { t, saveAddress } = useApp();
  const [scanned, setScanned] = useState<any>(null);
  const [torch, setTorch] = useState(false);
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, async () => {}];
  const lockRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = async (data: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const decoded = tryDecodeQR(data);
    if (decoded) setScanned(decoded);
    setTimeout(() => { lockRef.current = false; }, 800);
  };

  const importAddress = async () => {
    if (!scanned) return;
    const a: AddressDTO = {
      id: `${Date.now()}`,
      address_id: scanned.aid,
      district: scanned.d || 'Unknown',
      sector: scanned.s || 'X',
      street_id: scanned.st || '000',
      house_number: scanned.h || '000',
      latitude: scanned.lt || 0,
      longitude: scanned.lg || 0,
      accuracy_meters: 2.0,
      contact_name: scanned.n || '',
      contact_phone: '',
      notes: 'imported',
      owner_id: 'guest',
      verified: false,
      flag_count: 0,
      created_at: new Date().toISOString(),
    };
    await saveAddress(a);
    setScanned(null);
    router.replace(`/address/${encodeURIComponent(a.address_id)}`);
  };

  // Web fallback or no camera: provide manual paste
  if (Platform.OS === 'web' || !CameraView) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="scan-screen">
        <View style={styles.header}>
          <Text style={styles.title}>{t.scan.title}</Text>
        </View>
        <View style={styles.webFallback}>
          <Ionicons name="qr-code-outline" size={84} color={Colors.primary} />
          <Text style={styles.fallbackTitle}>{t.scan.hint}</Text>
          <Text style={styles.fallbackBody}>
            La caméra n'est pas disponible dans le navigateur. Utilisez l'app mobile pour scanner les QR.
          </Text>
          <Button
            label="Demo: Importer une adresse de test"
            variant="primary"
            testID="demo-import-btn"
            onPress={async () => {
              const demo: AddressDTO = {
                id: `${Date.now()}`,
                address_id: 'BNA-F034-X156',
                district: 'Bonamoussadi', sector: 'F', street_id: '034', house_number: '156',
                latitude: 4.0951, longitude: 9.7679, accuracy_meters: 0.9,
                contact_name: 'Demo Contact', contact_phone: '+237600000000', notes: 'imported demo',
                owner_id: 'guest', verified: true, flag_count: 0,
                created_at: new Date().toISOString(),
              };
              await saveAddress(demo);
              router.replace(`/address/${encodeURIComponent(demo.address_id)}`);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (permission && !permission.granted) {
    return (
      <SafeAreaView style={styles.container} testID="scan-permission">
        <View style={styles.permission}>
          <Text style={styles.title}>{t.scan.permission}</Text>
          <Button label={t.scan.grant} onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="scan-screen">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }: { data: string }) => handleScan(data)}
      />
      <View style={styles.overlayTop}>
        <Text style={styles.overlayHint}>{t.scan.hint}</Text>
      </View>
      <View style={styles.frame} pointerEvents="none">
        <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
        <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
        <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
        <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
      </View>
      <TouchableOpacity style={styles.torchBtn} onPress={() => setTorch((v) => !v)} testID="torch-btn">
        <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={Colors.white} />
      </TouchableOpacity>
      {scanned && (
        <View style={styles.sheet} testID="scan-result-sheet">
          <Text style={styles.sheetTitle}>{t.scan.success}</Text>
          <Text style={styles.sheetCode}>{scanned.aid}</Text>
          <Button label={t.scan.addToBook} variant="primary" onPress={importAddress} testID="import-scanned-btn" />
          <View style={{ height: 8 }} />
          <Button label={t.scan.retry} variant="ghost" onPress={() => setScanned(null)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  fallbackTitle: { ...Typography.h2, textAlign: 'center', marginTop: Spacing.md },
  fallbackBody: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  permission: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  overlayTop: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center' },
  overlayHint: { color: Colors.white, fontFamily: 'DMSans_500Medium', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  frame: { position: 'absolute', top: '30%', left: '15%', width: '70%', aspectRatio: 1 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: Colors.accent },
  torchBtn: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, padding: Spacing.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...Shadows.fab },
  sheetTitle: { ...Typography.h3, marginBottom: 4 },
  sheetCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 20, color: Colors.primary, letterSpacing: 1.5, marginBottom: Spacing.md },
});
