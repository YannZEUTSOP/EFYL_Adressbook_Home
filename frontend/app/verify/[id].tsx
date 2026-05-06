import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Storage } from '../../src/services/storage';
import { Api, AddressDTO } from '../../src/services/api';
import { Button } from '../../src/components/Button';
import { Pill } from '../../src/components/Pill';

export default function VerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useApp();
  const [addr, setAddr] = useState<AddressDTO | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verified: boolean; flagged: boolean; distance_m: number } | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const list = await Storage.getAddresses();
      setAddr(list.find((a) => a.address_id === decodeURIComponent(String(id))) || null);
    })();
  }, [id]);

  useEffect(() => {
    if (!measuring) return;
    Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })
    ).start();
    return () => pulse.stopAnimation();
  }, [measuring, pulse]);

  useEffect(() => () => { watchRef.current?.remove(); }, []);

  const start = async () => {
    setMeasuring(true);
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        Alert.alert('GPS indisponible', "Votre navigateur ne supporte pas la géolocalisation.");
        setMeasuring(false);
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 99 }),
        (err) => {
          setMeasuring(false);
          const code = err?.code;
          let msg = "Autorisez la géolocalisation dans votre navigateur puis réessayez.";
          if (code === 2) msg = "Position introuvable. Vérifiez que le GPS est activé.";
          else if (code === 3) msg = "Délai dépassé. Ciel dégagé et réessayez.";
          Alert.alert('Géolocalisation refusée', msg);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
      );
      watchRef.current = { remove: () => navigator.geolocation.clearWatch(id) } as Location.LocationSubscription;
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return setMeasuring(false);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 800 },
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 99 })
    );
  };

  const submit = async () => {
    if (!coords || !addr) return;
    setLoading(true);
    try {
      const r = await Api.verify(addr.address_id, coords.lat, coords.lng, coords.accuracy);
      setResult(r);
      // update local
      const list = await Storage.getAddresses();
      const next = list.map((a) =>
        a.address_id === addr.address_id
          ? { ...a, verified: r.verified, flag_count: r.flagged ? a.flag_count + 1 : a.flag_count }
          : a
      );
      await Storage.setAddresses(next);
    } catch (e: any) {
      const msg = e?.message || 'Failed';
      if (Platform.OS === 'web') alert(msg); else Alert.alert(msg);
    } finally {
      setLoading(false);
      watchRef.current?.remove();
      setMeasuring(false);
    }
  };

  if (!addr) return <SafeAreaView style={styles.container}><Text>—</Text></SafeAreaView>;

  const variant = !coords ? 'red' : coords.accuracy <= 1.0 ? 'green' : coords.accuracy <= 3.0 ? 'yellow' : 'red';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="verify-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.verify.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: Spacing.lg }}>
        <View style={styles.targetCard}>
          <Text style={styles.targetCode}>{addr.address_id}</Text>
          <Text style={styles.targetMeta}>{addr.contact_name || addr.district}</Text>
        </View>

        <Text style={styles.instruction}>{t.verify.instruction}</Text>

        <View style={styles.gpsCard}>
          <Animated.View
            style={[
              styles.pulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                borderColor: variant === 'green' ? Colors.gpsGreen : variant === 'yellow' ? Colors.gpsYellow : Colors.gpsRed,
              },
            ]}
          />
          <View style={[styles.center, { backgroundColor: variant === 'green' ? Colors.gpsGreen : variant === 'yellow' ? Colors.gpsYellow : Colors.gpsRed }]}>
            <Ionicons name="locate" size={26} color={Colors.white} />
          </View>
          <Text style={styles.gpsValue}>{coords ? `${coords.accuracy.toFixed(1)} m` : '—'}</Text>
          <Pill variant={variant} label={!coords ? 'No GPS' : variant === 'green' ? 'Excellent' : variant === 'yellow' ? 'Acceptable' : 'Locking…'} />
        </View>

        {!measuring && !result && <Button label="📡 Start" onPress={start} testID="verify-start-btn" />}
        {measuring && <Button label={t.verify.submit} onPress={submit} loading={loading} disabled={!coords || coords.accuracy > 3} testID="verify-submit-btn" />}

        {result && (
          <View style={[styles.resultCard, { backgroundColor: result.flagged ? Colors.pillRedBg : Colors.pillGreenBg }]} testID="verify-result">
            <Text style={[styles.resultTitle, { color: result.flagged ? Colors.error : Colors.success }]}>
              {result.flagged ? t.verify.successFlag : t.verify.successOk}
            </Text>
            <Text style={styles.resultMeta}>Distance: {result.distance_m.toFixed(1)}m</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  targetCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.md, ...Shadows.card },
  targetCode: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: Colors.primary, letterSpacing: 1.5 },
  targetMeta: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 4 },
  instruction: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  gpsCard: { alignItems: 'center', padding: Spacing.lg, marginBottom: Spacing.lg },
  pulse: { position: 'absolute', top: Spacing.lg, width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  center: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  gpsValue: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 28, marginBottom: Spacing.sm },
  resultCard: { padding: Spacing.lg, borderRadius: Radius.lg, marginTop: Spacing.lg, alignItems: 'center' },
  resultTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  resultMeta: { ...Typography.bodySm, marginTop: 4 },
});
