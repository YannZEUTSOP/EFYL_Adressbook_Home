import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform,
  Animated, Easing, TextInput, KeyboardAvoidingView, Linking, Image, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Button } from '../src/components/Button';
import { Pill } from '../src/components/Pill';
import { LeafletMap } from '../src/components/LeafletMap';
import { buildAddressId, formatAddressDisplay } from '../src/utils/address';
import type { AddressDTO } from '../src/services/api';

type Coords = { latitude: number; longitude: number; accuracy: number; timestamp: number };

const { width } = Dimensions.get('window');

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

export default function NewAddress() {
  const router = useRouter();
  const { t, saveAddress } = useApp();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [measuring, setMeasuring] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [allowSaveAnyway, setAllowSaveAnyway] = useState(false);
  const [lowAccuracy, setLowAccuracy] = useState(false);

  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('A');
  const [streetId, setStreetId] = useState('001');
  const [houseNumber, setHouseNumber] = useState('001');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  // Step 3 — compass + photo
  const [compassDeg, setCompassDeg] = useState<number | null>(null);
  const [lockedAzimuth, setLockedAzimuth] = useState<number | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<any>(null);
  const magSubRef = useRef<any>(null);

  // Step 4 — satellite correction
  const [latCorrected, setLatCorrected] = useState<number | null>(null);
  const [lngCorrected, setLngCorrected] = useState<number | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const elapsedTimerRef = useRef<any>(null);

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

  useEffect(() => () => { watchSub.current?.remove(); if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); }, []);

  // Start magnetometer when entering step 3
  useEffect(() => {
    if (step === 3 && Platform.OS !== 'web') {
      try {
        const { Magnetometer } = require('expo-sensors');
        Magnetometer.isAvailableAsync().then((avail: boolean) => {
          if (!avail) return;
          Magnetometer.setUpdateInterval(300);
          magSubRef.current = Magnetometer.addListener(({ x, y }: { x: number; y: number }) => {
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            angle = (angle + 360) % 360;
            const heading = (90 - angle + 360) % 360;
            setCompassDeg(heading);
          });
        }).catch(() => { /* sensor not available */ });
      } catch { /* expo-sensors not available */ }
    }
    return () => {
      if (magSubRef.current) {
        magSubRef.current.remove();
        magSubRef.current = null;
      }
    };
  }, [step]);

  const startMeasure = async () => {
    setAllowSaveAnyway(false);
    setLowAccuracy(false);
    setCoords(null);
    setElapsedSec(0);

    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        Alert.alert('GPS indisponible', "Votre navigateur ne prend pas en charge la géolocalisation.");
        return;
      }
      setMeasuring(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 99,
            timestamp: pos.timestamp,
          });
          if ((pos.coords.accuracy ?? 99) <= 1.0) {
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* ignore */ }
          }
        },
        (err) => {
          setMeasuring(false);
          const code = err?.code;
          let title = 'Géolocalisation refusée';
          let msg = "Autorisez la géolocalisation dans votre navigateur puis réessayez.";
          if (code === 2) { title = 'GPS indisponible'; msg = "Position introuvable. Vérifiez que le GPS est activé."; }
          else if (code === 3) { title = 'Délai dépassé'; msg = "Le signal GPS met trop de temps. Ciel dégagé et réessayez."; }
          Alert.alert(title, msg);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
      );
      watchSub.current = { remove: () => navigator.geolocation.clearWatch(id) } as Location.LocationSubscription;
      // elapsed counter
      elapsedTimerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
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
        canAskAgain ? "Autorisez l'accès à la position pour mesurer votre porte."
                    : "L'accès à la position a été refusé. Ouvrez les Réglages.",
        [
          { text: 'Annuler', style: 'cancel' },
          ...(!canAskAgain ? [{ text: 'Réglages', onPress: () => Linking.openSettings() }] : []),
        ]
      );
      return;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert('GPS désactivé', "Activez la localisation dans les réglages de l'appareil.");
      return;
    }
    setMeasuring(true);
    watchSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 800, distanceInterval: 0 },
      (pos) => setCoords({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 99, timestamp: pos.timestamp,
      })
    );
    elapsedTimerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  };

  // Enable Save Anyway after 120 sec if still > 3m
  useEffect(() => {
    if (measuring && elapsedSec >= 120 && coords && coords.accuracy > 3.0) {
      setAllowSaveAnyway(true);
    }
  }, [elapsedSec, measuring, coords]);

  const stopMeasure = () => {
    watchSub.current?.remove();
    watchSub.current = null;
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setMeasuring(false);
  };

  const accuracyVariant: 'red' | 'yellow' | 'green' = !coords ? 'red'
    : coords.accuracy <= 1.0 ? 'green'
    : coords.accuracy <= 3.0 ? 'yellow' : 'red';

  const canConfirm = !!coords && coords.accuracy <= 3.0;

  const onConfirm = async (override = false) => {
    stopMeasure();
    if (override) setLowAccuracy(true);
    if (!coords) return;
    // Reverse geocode
    if (Platform.OS !== 'web') {
      try {
        setReverseLoading(true);
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.latitude, longitude: coords.longitude,
        });
        if (results && results[0]) {
          const r = results[0];
          const detected = r.district || r.subregion || r.city || r.region || r.name || '';
          if (detected) setDistrict(detected);
          if (r.streetNumber) {
            setHouseNumber(r.streetNumber.replace(/\D/g, '').padStart(3, '0').slice(-3));
          }
        }
      } catch { /* ignore */ }
      finally { setReverseLoading(false); }
    } else {
      try {
        setReverseLoading(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=16&accept-language=fr`
        );
        if (res.ok) {
          const data = await res.json();
          const a = data.address || {};
          const detected = a.suburb || a.neighbourhood || a.city_district || a.town || a.village || a.city || a.county || a.state || '';
          if (detected) setDistrict(detected);
          if (a.house_number) {
            setHouseNumber(String(a.house_number).replace(/\D/g, '').padStart(3, '0').slice(-3));
          }
        }
      } catch { /* ignore */ }
      finally { setReverseLoading(false); }
    }
    setStep(2);
  };

  const computedAddressId = buildAddressId(district || 'XXX', sector, streetId, houseNumber);
  const display = formatAddressDisplay(district || '—', sector, streetId, houseNumber);

  // Step 3 — photo capture
  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Photo', "La capture photo nécessite l'application mobile.");
      return;
    }
    try {
      const cam = require('expo-camera');
      const perm = await cam.Camera.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('Camera', 'Permission caméra refusée'); return; }
      setCameraOpen(true);
    } catch {
      Alert.alert('Photo', "Le module caméra n'est pas disponible.");
    }
  };

  const captureFromCamera = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, base64: true, skipProcessing: false,
      });
      if (photo?.base64) setPhotoBase64(photo.base64);
      setCameraOpen(false);
    } catch (e) {
      Alert.alert('Photo', "Erreur lors de la capture.");
    }
  };

  const lockDirection = () => {
    if (compassDeg !== null) {
      setLockedAzimuth(compassDeg);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* ignore */ }
    }
  };

  const onApplySatellite = () => {
    // latCorrected/lngCorrected are updated by Leaflet drag handler
    setStep(5);
  };

  const onSave = async () => {
    if (!coords) return;
    const final_lat = latCorrected ?? coords.latitude;
    const final_lng = lngCorrected ?? coords.longitude;
    const addr: AddressDTO = {
      id: `${Date.now()}`,
      address_id: computedAddressId,
      district: district || 'Unknown',
      sector: sector || 'A',
      street_id: streetId || '001',
      house_number: houseNumber || '001',
      latitude: final_lat, longitude: final_lng,
      accuracy_meters: Number(coords.accuracy.toFixed(2)),
      contact_name: contactName, contact_phone: contactPhone, notes,
      owner_id: 'guest',
      verified: false, flag_count: 0,
      low_accuracy: lowAccuracy,
      azimuth_degrees: lockedAzimuth,
      photo_base64: photoBase64,
      lat_raw: coords.latitude, lng_raw: coords.longitude,
      lat_corrected: latCorrected, lng_corrected: lngCorrected,
      has_survey: false,
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
        {[1, 2, 3, 4, 5].map((n) => (
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
                        borderColor: accuracyVariant === 'green' ? Colors.gpsGreen
                          : accuracyVariant === 'yellow' ? Colors.gpsYellow : Colors.gpsRed,
                      },
                    ]}
                  />
                  <View style={[styles.gpsCenter, {
                    backgroundColor: accuracyVariant === 'green' ? Colors.gpsGreen
                      : accuracyVariant === 'yellow' ? Colors.gpsYellow : Colors.gpsRed,
                  }]}>
                    <Ionicons name="locate" size={32} color={Colors.white} />
                  </View>
                </View>
                <Text style={styles.gpsValue} testID="gps-accuracy-value">
                  {coords ? `${coords.accuracy.toFixed(1)} m` : '—'}
                </Text>
                <Pill
                  testID="gps-accuracy-pill"
                  variant={accuracyVariant}
                  label={!coords ? 'No GPS Lock' : coords.accuracy <= 1.0 ? '✓ Excellent'
                    : coords.accuracy <= 3.0 ? 'Acceptable' : 'Locking…'}
                />
                {measuring && (
                  <Text style={styles.elapsed}>⏱ {elapsedSec}s</Text>
                )}
                <Text style={styles.tip}>{t.newAddress.tip1}</Text>
                <Text style={styles.tipSm}>{t.newAddress.tip2}</Text>
                <Text style={styles.tipSm}>{t.newAddress.tip3}</Text>
              </View>

              {!measuring ? (
                <Button testID="measure-btn" label={`📡  ${t.newAddress.measure}`} onPress={startMeasure} />
              ) : (
                <>
                  <Button
                    testID="confirm-gps-btn"
                    label={`✓  ${t.newAddress.confirm}`}
                    onPress={() => onConfirm(false)}
                    disabled={!canConfirm}
                  />
                  {allowSaveAnyway && (
                    <>
                      <View style={styles.warnBox}>
                        <Ionicons name="warning" size={18} color={Colors.warning} />
                        <Text style={styles.warnText}>{t.newAddress.saveAnywayWarn}</Text>
                      </View>
                      <Button
                        testID="save-anyway-btn"
                        label={`⚠  ${t.newAddress.saveAnyway}`}
                        variant="accent"
                        onPress={() => onConfirm(true)}
                      />
                    </>
                  )}
                </>
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
              {reverseLoading && <Text style={styles.detectHint}>🌍 {t.newAddress.detecting}</Text>}
              {!!district && !reverseLoading && (
                <Text style={styles.detectHint}>
                  📍 {t.newAddress.detectedAuto} : <Text style={styles.detectBold}>{district}</Text>
                </Text>
              )}
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
              {/* Compass */}
              <View style={styles.compassCard}>
                <Text style={styles.compassLabel}>{t.newAddress.compassTitle}</Text>
                <Text style={styles.compassHint}>{t.newAddress.compassInstruction}</Text>
                <View style={styles.compassDisplay}>
                  <Animated.View
                    style={[
                      styles.compassDial,
                      compassDeg !== null && {
                        transform: [{ rotate: `-${compassDeg}deg` }],
                      },
                    ]}
                  >
                    <Text style={styles.compassN}>N</Text>
                    <Text style={styles.compassE}>E</Text>
                    <Text style={styles.compassS}>S</Text>
                    <Text style={styles.compassW}>O</Text>
                  </Animated.View>
                  <Ionicons name="navigate" size={48} color={Colors.primary} style={{ position: 'absolute' }} />
                </View>
                <Text style={styles.compassValue}>
                  {compassDeg !== null ? `${Math.round(compassDeg)}° ${compassLabel(compassDeg)}` : '—'}
                </Text>
                {lockedAzimuth !== null && (
                  <Pill variant="green" label={`✓ ${Math.round(lockedAzimuth)}° ${compassLabel(lockedAzimuth)}`} />
                )}
                <Button
                  label={lockedAzimuth !== null ? t.newAddress.directionLocked : t.newAddress.lockDirection}
                  variant={lockedAzimuth !== null ? 'secondary' : 'primary'}
                  onPress={lockDirection}
                  disabled={compassDeg === null}
                  testID="lock-direction-btn"
                  style={{ marginTop: Spacing.md }}
                />
              </View>

              {/* Photo */}
              <View style={styles.photoCard}>
                <Text style={styles.compassLabel}>{t.newAddress.photoTitle} <Text style={styles.optional}>({t.newAddress.photoOptional})</Text></Text>
                {photoBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={48} color={Colors.textTertiary} />
                  </View>
                )}
                <Button
                  label={photoBase64 ? t.newAddress.retakePhoto : t.newAddress.takePhoto}
                  variant="secondary"
                  onPress={takePhoto}
                  testID="take-photo-btn"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md }}>
                <Button label={t.newAddress.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(2)} />
                <Button testID="step-3-next-btn" label={t.newAddress.next} style={{ flex: 1 }} onPress={() => setStep(4)} />
              </View>
            </View>
          )}

          {step === 4 && coords && (
            <View testID="step-4">
              <Text style={styles.sectionTitle}>{t.newAddress.step4}</Text>
              <Text style={styles.detectHint}>{t.newAddress.satelliteInstruction}</Text>
              <View style={styles.satMapWrap}>
                <LeafletMap
                  centerLat={latCorrected ?? coords.latitude}
                  centerLng={lngCorrected ?? coords.longitude}
                  zoom={18}
                  satellite
                  draggablePin
                  draggableInitialLat={latCorrected ?? coords.latitude}
                  draggableInitialLng={lngCorrected ?? coords.longitude}
                  onPinDrag={(lat, lng) => { setLatCorrected(lat); setLngCorrected(lng); }}
                  style={{ height: 360 }}
                />
              </View>
              {latCorrected !== null && lngCorrected !== null && (
                <View style={styles.correctedBox}>
                  <Text style={styles.correctedLine}>
                    <Text style={styles.correctedLabel}>GPS brut: </Text>
                    {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.correctedLine}>
                    <Text style={styles.correctedLabel}>GPS corrigé: </Text>
                    {latCorrected.toFixed(6)}, {lngCorrected.toFixed(6)}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label={t.newAddress.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(3)} />
                <Button
                  label={latCorrected !== null ? t.newAddress.satelliteApply : t.newAddress.satelliteSkip}
                  style={{ flex: 1 }}
                  onPress={onApplySatellite}
                  testID="step-4-next-btn"
                />
              </View>
            </View>
          )}

          {step === 5 && (
            <View testID="step-5">
              <Text style={styles.sectionTitle}>{t.newAddress.step5}</Text>
              <View style={styles.reviewCard}>
                <Text style={styles.codePreviewVal}>{computedAddressId}</Text>
                <Text style={styles.codePreviewMeta}>{display}</Text>
                {!!contactName && <Text style={styles.reviewLine}>👤 {contactName}</Text>}
                {!!contactPhone && <Text style={styles.reviewLine}>📞 {contactPhone}</Text>}
                {!!notes && <Text style={styles.reviewLine}>📝 {notes}</Text>}
                {coords && (
                  <Text style={styles.reviewLine}>
                    📍 {(latCorrected ?? coords.latitude).toFixed(6)}, {(lngCorrected ?? coords.longitude).toFixed(6)} • {coords.accuracy.toFixed(1)}m
                  </Text>
                )}
                {lockedAzimuth !== null && (
                  <Text style={styles.reviewLine}>🧭 {Math.round(lockedAzimuth)}° {compassLabel(lockedAzimuth)}</Text>
                )}
                {photoBase64 && (
                  <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.reviewPhoto} />
                )}
                {lowAccuracy && (
                  <View style={{ marginTop: 8 }}>
                    <Pill variant="red" label={`⚠ ${t.detail.lowAccuracy}`} />
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <Button label={t.newAddress.back} variant="secondary" style={{ flex: 1 }} onPress={() => setStep(4)} />
                <Button testID="save-address-btn" label={t.newAddress.save} variant="accent" style={{ flex: 1 }} onPress={onSave} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Camera modal for photo capture */}
      {cameraOpen && Platform.OS !== 'web' && (() => {
        const { CameraView } = require('expo-camera');
        return (
          <Modal visible={cameraOpen} animationType="slide">
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
              <View style={styles.camControls}>
                <TouchableOpacity onPress={() => setCameraOpen(false)} style={styles.camBtn}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={captureFromCamera} style={styles.shutter}>
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
                <View style={{ width: 56 }} />
              </View>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad'; testID?: string;
}> = ({ label, value, onChange, keyboardType = 'default', testID }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      testID={testID}
      style={styles.fieldInput}
      value={value} onChangeText={onChange}
      keyboardType={keyboardType}
      placeholderTextColor={Colors.textTertiary}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  stepper: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: Spacing.md },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.divider },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, fontSize: 12 },
  stepNumActive: { color: Colors.white },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.md },
  gpsCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.card },
  gpsRing: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  gpsRingPulse: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 4 },
  gpsCenter: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  gpsValue: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 36, color: Colors.textPrimary, marginBottom: Spacing.sm },
  elapsed: { ...Typography.bodySm, color: Colors.textTertiary, marginTop: 4 },
  tip: { ...Typography.body, textAlign: 'center', marginTop: Spacing.md },
  tipSm: { ...Typography.bodySm, textAlign: 'center', color: Colors.textTertiary },
  cancelTxt: { ...Typography.label, color: Colors.textSecondary },
  warnBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', padding: Spacing.md, borderRadius: Radius.md, marginVertical: Spacing.md, alignItems: 'flex-start' },
  warnText: { ...Typography.bodySm, color: Colors.gpsYellow, flex: 1, fontFamily: 'DMSans_500Medium' },
  field: { marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 48, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary },
  codePreview: { backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginBottom: Spacing.lg },
  codePreviewLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  codePreviewVal: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: 1.5, marginBottom: 4 },
  codePreviewMeta: { ...Typography.bodySm, color: Colors.textSecondary },
  reviewCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.lg, ...Shadows.card },
  reviewLine: { ...Typography.body, color: Colors.textSecondary, marginTop: 6 },
  reviewPhoto: { marginTop: Spacing.md, width: '100%', height: 180, borderRadius: Radius.md },
  detectHint: { ...Typography.bodySm, color: Colors.primary, marginBottom: Spacing.sm, fontFamily: 'DMSans_500Medium' },
  detectBold: { fontFamily: 'DMSans_700Bold', color: Colors.primary },
  compassCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.card },
  compassLabel: { ...Typography.h3, marginBottom: 4 },
  optional: { fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, fontSize: 13 },
  compassHint: { ...Typography.bodySm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  compassDisplay: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, borderColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md, position: 'relative' },
  compassDial: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  compassN: { position: 'absolute', top: 4, fontFamily: 'DMSans_700Bold', color: Colors.error },
  compassE: { position: 'absolute', right: 4, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  compassS: { position: 'absolute', bottom: 4, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  compassW: { position: 'absolute', left: 4, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  compassValue: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22, color: Colors.primary, marginBottom: Spacing.sm },
  photoCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.card },
  photoPlaceholder: { width: '100%', height: 160, backgroundColor: Colors.surface, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md },
  photoPreview: { width: '100%', height: 200, borderRadius: Radius.md, marginVertical: Spacing.md, resizeMode: 'cover' },
  satMapWrap: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md, ...Shadows.card },
  correctedBox: { backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  correctedLine: { ...Typography.bodySm, fontFamily: 'JetBrainsMono_700Bold', color: Colors.textPrimary, marginVertical: 2 },
  correctedLabel: { fontFamily: 'DMSans_500Medium', color: Colors.textSecondary },
  camControls: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 32 },
  camBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
});
