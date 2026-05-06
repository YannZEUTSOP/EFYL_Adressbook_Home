import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { Button } from '../src/components/Button';
import { useApp } from '../src/contexts/AppContext';
import { Api, AddressDTO } from '../src/services/api';

export default function ImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, saveAddress } = useApp();
  const [addr, setAddr] = useState<AddressDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await Api.getAddress(decodeURIComponent(String(id)));
        setAddr(a);
      } catch (e: any) {
        setError(e?.message || 'Not found');
      }
    })();
  }, [id]);

  const importIt = async () => {
    if (!addr) return;
    await saveAddress(addr);
    router.replace(`/address/${encodeURIComponent(addr.address_id)}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="import-screen">
      <View style={styles.body}>
        <Text style={styles.title}>📍 Imported Address</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {addr && (
          <View style={styles.card}>
            <Text style={styles.code}>{addr.address_id}</Text>
            <Text style={styles.meta}>{addr.contact_name || addr.district}</Text>
            <Text style={styles.meta}>{addr.latitude.toFixed(4)}, {addr.longitude.toFixed(4)}</Text>
          </View>
        )}
        <Button label={t.scan.addToBook} onPress={importIt} disabled={!addr} testID="import-confirm-btn" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, padding: Spacing.lg, justifyContent: 'center' },
  title: { ...Typography.h1, textAlign: 'center', marginBottom: Spacing.lg },
  card: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.lg, alignItems: 'center', ...Shadows.card },
  code: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: 1.5, marginBottom: 6 },
  meta: { ...Typography.body, color: Colors.textSecondary },
  error: { ...Typography.body, color: Colors.error, textAlign: 'center', marginBottom: Spacing.md },
});
