import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Animated, Easing, TextInput, KeyboardAvoidingView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Button } from '../src/components/Button';
import { Pill } from '../src/components/Pill';
import { buildAddressId, formatAddressDisplay } from '../src/utils/address';
import type { AddressDTO } from '../src/services/api';

type Coords = { latitude: number; longitude: number; accuracy: number; timestamp: number };

export default function NewAddress() {
  const router = useRouter();
  const { t, saveAddress, language } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [measuring, setMeasuring] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [district, setDistrict] = useState('Bonamoussadi');
  const [sector, setSector] = useState('F');
  const [streetId, setStreetId] = useState('034');
  const [houseNumber, setHouseNumber] = useState('156');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  const pulse = useRef(new Animated.Value(0)).current;
  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!measuring) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    ).start();
  }, [measuring, pulse]);

  useEffect(() => () => { watchSub.current?.remove(); }, []);

  const startMeasure = async () => {
    setConfirmed(false);
    setCoords(null);
    if (Platform.OS === 'web') {
      // Browser geolocation
      if (!('geolocation' in navigator)) {
        Alert.alert('GPS', 'Geolocation not available in this browser');
        return;
      }
      setMeasuring(true);
      startTimeRef.current = Date.now();
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const c: Coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 99,
            timestamp: pos.timestamp,
          };
          setCoords(c);
          if (c.accuracy <= 1.0) {
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* ignore */ }
          }
        },
        () => {
          // simulate when permission denied: provide demo coords near Bonamoussadi
          let acc = 8;
          const tick = setInterval(() => {
            acc = Math.max(0.7, acc * 0.85);
            setCoords({
              latitude: 4.0951 + (Math.random() - 0.5) * 0.0001,
              longitude: 9.7679 + (Math.random() - 0.5) * 0.0001,
              accuracy: Number(acc.toFixed(1)),
              timestamp: Date.now(),
            });
            if (acc <= 0.8) clearInterval(tick);
          }, 800);
          // store cleanup id by reusing watchSub
          watchSub.current = { remove: () => clearInterval(tick) } as Location.LocationSubscription;
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
      );
      watchSub.current = { remove: () => navigator.geolocation.clearWatch(id) } as Location.LocationSubscription;
      return;
    }
    const current = await Location.getForegroundPermissionsAsync();
    let status = current.status;
    let canAskAgain = current.canAskAgain;
    if (status !== 'granted') {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
      canAskAgain = asked.canAskAgain;
    }
    if (status !== 'granted') {
      Alert.alert(
        'Permission GPS requise',
        canAskAgain
          ? "Autorisez l'accès à la position pour mesurer votre porte."
          : "L'accès à la position a été refusé. Ouvrez les Réglages pour l'activer.",
        [
          { text: 'Annuler', style: 'cancel' },
          ...(!canAskAgain
            ? [{ text: 'Réglages', onPress: () => Linking.openSettings() }]
            : []),
        ]
      );
      return;
    }
    // Ensure GPS/Location services are enabled on device
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert('GPS désactivé', "Activez la localisation dans les réglages de l'appareil.");
      return;
    }
    setMeasuring(true);
    startTimeRef.current = Date.now();
    watchSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 800, distanceInterval: 0 },
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 99,
          timestamp: pos.timestamp,
        });
      }
    );
  };

  const stopMeasure = () => {
    watchSub.current?.remove();
    watchSub.current = null;
    setMeasuring(false);
  };

  const accuracyVariant: 'red' | 'yellow' | 'green' = !coords
    ? 'red'
    : coords.accuracy <= 1.0
    ? 'green'
    : coords.accuracy <= 3.0
    ? 'yellow'
    : 'red';

  const canConfirm = !!coords && coords.accuracy <= 3.0;

  const onConfirm = () => {
    stopMeasure();
    setConfirmed(true);
    setStep(2);
  };

  const computedAddressId = buildAddressId(district, sector, streetId, houseNumber);
  const display = formatAddressDisplay(district, sector, streetId, houseNumber);

  const onSave = async () => {
    if (!coords) return;
    const addr: AddressDTO = {
      id: `${Date.now()}`,
      address_id: computedAddressId,
      district, sector, street_id: streetId, house_number: houseNumber,
      latitude: coords.latitude, longitude: coords.longitude,
      accuracy_meters: Number(coords.accuracy.toFixed(2)),
      contact_name: contactName, contact_phone: contactPhone, notes,
      owner_id: 'guest',
      verified: false, flag_count: 0,
      created_at: new Date().toISOString(),
    };
    await saveAddress(addr);
    router.replace(`/qr/${encodeURIComponent(computedAddressId)}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="new-address-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.newAddress.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.stepper}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.stepDot, step >= n && styles.stepDotActive]}>
            <Text style={[styles.stepNum, step >= n && styles.stepNumActive]}>{n}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
          {step === 1 && (
            <View testID="step-1">
              <Text style={styles.sectionTitle}>{t.newAddress.step1}</Text>
              <View style={styles.gpsCard}>
                <View style={styles.gpsRing}>
                  <Animated.View
                    style={[
                      styles.gpsRingPulse,
                      {
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                        borderColor: accuracyVariant === 'green' ? Colors.gpsGreen : accuracyVariant === 'yellow' ? Colors.gpsYellow : Colors.gpsRed,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.gpsCenter,
                      {
                        backgroundColor:
                          accuracyVariant === 'green'
                            ? Colors.gpsGreen
                            : accuracyVariant === 'yellow'
                            ? Colors.gpsYellow
                            : Colors.gpsRed,
                      },
                    ]}
                  >
                    <Ionicons name="locate" size={32} color={Colors.white} />
                  </View>
                </View>
                <Text style={styles.gpsValue} testID="gps-accuracy-value">
                  {coords ? `${coords.accuracy.toFixed(1)} m` : '—'}
                </Text>
                <Pill
                  testID="gps-accuracy-pill"
                  variant={accuracyVariant}
                  label={
                    !coords
                      ? 'No GPS Lock'
                      : coords.accuracy <= 1.0
                      ? `✓ Excellent`
                      : coords.accuracy <= 3.0
                      ? 'Acceptable'
                      : 'Locking…'
                  }
                />
                <Text style={styles.tip}>{t.newAddress.tip1}</Text>
                <Text style={styles.tipSm}>{t.newAddress.tip2}</Text>
                <Text style={styles.tipSm}>{t.newAddress.tip3}</Text>
              </View>

              {!measuring ? (
                <Button
                  testID="measure-btn"
                  label={`📡  ${t.newAddress.measure}`}
                  onPress={startMeasure}
                />
              ) : (
                <Button
                  testID="confirm-gps-btn"
                  label={`✓  ${t.newAddress.confirm}`}
                  onPress={onConfirm}
                  disabled={!canConfirm}
                  variant="primary"
                />
              )}
              {measuring && (
                <TouchableOpacity onPress={stopMeasure} style={{ alignSelf: 'center', marginTop: 12 }}>
                  <Text style={styles.cancelTxt}>{t.common.cancel}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {step === 2 && (
            <View testID="step-2">
              <Text style={styles.sectionTitle}>{t.newAddress.step2}</Text>
              <Field label={t.newAddress.district} value={district} onChange={setDistrict} testID="field-district" />
              <Field label={t.newAddress.sector} value={sector} onChange={(v) => setSector(v.toUpperCase().slice(0, 2))} testID="field-sector" />
              <Field label={t.newAddress.street} value={streetId} onChange={setStreetId} keyboardType="number-pad" testID="field-street" />
              <Field label={t.newAddress.house} value={houseNumber} onChange={setHouseNumber} keyboardType="number-pad" testID="field-house" />
              <Field label={t.newAddress.contactName} value={contactName} onChange={setContactName} testID="field-name" />
              <Field label={t.newAddress.contactPhone} value={contactPhone} onChange={setContactPhone} keyboardType="phone-pad" testID="field-phone" />
              <Field label={t.newAddress.notes} value={notes} onChange={setNotes} testID="field-notes" />

              <View style={styles.codePreview} testID="code-preview">
                <Text style={styles.codePreviewLabel}>{t.newAddress.preview}</Text>
                <Text style={styles.codePreviewVal}>{computedAddressId}</Text>
                <Text style={styles.codePreviewMeta}>{display}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label={t.newAddress.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(1)} />
                <Button testID="step-2-next-btn" label={t.newAddress.next} style={{ flex: 1 }} onPress={() => setStep(3)} />
              </View>
            </View>
          )}

          {step === 3 && (
            <View testID="step-3">
              <Text style={styles.sectionTitle}>{t.newAddress.step3}</Text>
              <View style={styles.reviewCard}>
                <Text style={styles.codePreviewVal}>{computedAddressId}</Text>
                <Text style={styles.codePreviewMeta}>{display}</Text>
                {!!contactName && <Text style={styles.reviewLine}>👤 {contactName}</Text>}
                {!!contactPhone && <Text style={styles.reviewLine}>📞 {contactPhone}</Text>}
                {!!notes && <Text style={styles.reviewLine}>📝 {notes}</Text>}
                {coords && (
                  <Text style={styles.reviewLine}>
                    📍 {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)} • {coords.accuracy.toFixed(1)}m
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label={t.newAddress.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(2)} />
                <Button testID="save-address-btn" label={t.newAddress.save} variant="accent" style={{ flex: 1 }} onPress={onSave} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  testID?: string;
}> = ({ label, value, onChange, keyboardType = 'default', testID }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      testID={testID}
      style={styles.fieldInput}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholderTextColor={Colors.textTertiary}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  stepper: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing.md },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.divider },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, fontSize: 13 },
  stepNumActive: { color: Colors.white },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.md },
  gpsCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.card },
  gpsRing: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  gpsRingPulse: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 4 },
  gpsCenter: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  gpsValue: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 36, letterSpacing: 1, color: Colors.textPrimary, marginBottom: Spacing.sm },
  tip: { ...Typography.body, textAlign: 'center', marginTop: Spacing.md },
  tipSm: { ...Typography.bodySm, textAlign: 'center', color: Colors.textTertiary },
  cancelTxt: { ...Typography.label, color: Colors.textSecondary },
  field: { marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 48, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary },
  codePreview: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginBottom: Spacing.lg },
  codePreviewLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  codePreviewVal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: 1.5, marginBottom: 4 },
  codePreviewMeta: { ...Typography.bodySm, color: Colors.textSecondary },
  reviewCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.lg, ...Shadows.card },
  reviewLine: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
});
