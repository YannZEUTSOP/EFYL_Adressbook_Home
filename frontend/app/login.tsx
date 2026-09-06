import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Api } from '../src/services/api';
import type { AuthUser, GuestAccount, GuestCandidate } from '../src/services/api';
import { Storage } from '../src/services/storage';
import { getDeviceFingerprint } from '../src/services/device';
import { Button } from '../src/components/Button';

type Mode =
  | 'choice' | 'register' | 'register-otp' | 'register-done' | 'login'
  | 'guest-choice' | 'guest-new' | 'guest-done' | 'guest-lookup' | 'guest-pin';

export default function Login() {
  const router = useRouter();
  const { t, setUser, restoreAccount, surveyorName, setSurveyorName, deviceId } = useApp();
  const [mode, setMode] = useState<Mode>('choice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // register fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+237 6');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isRealSms, setIsRealSms] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [account, setAccount] = useState<AuthUser | null>(null);
  const [restoredCount, setRestoredCount] = useState<number | null>(null);

  // login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // ---- Guest identity (device-bound) ----
  const [fp, setFp] = useState<{ hash: string; label: string } | null>(null);
  const [knownAccounts, setKnownAccounts] = useState<GuestCandidate[]>([]);
  const [guestName, setGuestName] = useState('');
  const [created, setCreated] = useState<GuestAccount | null>(null);
  const [candidates, setCandidates] = useState<GuestCandidate[] | null>(null);
  const [selected, setSelected] = useState<GuestCandidate | null>(null);
  const [guestPin, setGuestPin] = useState('');
  const [guestIdInput, setGuestIdInput] = useState('');
  const [copied, setCopied] = useState<'id' | 'pin' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const f = await getDeviceFingerprint();
        setFp(f);
        const r = await Api.guestDeviceCheck(f.hash, f.label);
        setKnownAccounts(r.accounts || []);
      } catch {
        // offline or first launch — the screen stays fully usable
      }
    })();
  }, []);

  const fingerprint = async () => fp || (await getDeviceFingerprint());

  const finalizeGuest = async (u: GuestAccount, pin?: string): Promise<number> => {
    await setUser({
      loggedIn: true,
      isGuest: u.is_guest !== false,
      userId: u.user_id,
      guestId: u.guest_id || undefined,
      guestPin: pin || u.pin,
      efylId: u.efyl_id || undefined,
      name: u.name,
      token: u.token,
    });
    if (u.name && !surveyorName) await setSurveyorName(u.name);
    try {
      const r = await restoreAccount(u.token);
      return r.addresses;
    } catch {
      return 0;
    }
  };

  const createGuest = async () => {
    setError('');
    if (guestName.trim().length < 2) { setError(t.guest.errName); return; }
    setLoading(true);
    try {
      const f = await fingerprint();
      const u = await Api.guestRegister({
        name: guestName.trim(), device_hash: f.hash,
        device_id: deviceId, device_label: f.label,
      });
      setCreated(u);
      await finalizeGuest(u, u.pin);
      setMode('guest-done');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.startsWith('API 4')) {
        setError(msg.replace(/^API \d+:\s*/, ''));
      } else {
        // No network: work now, identity finalised automatically at next sync
        const prefs = await Storage.getPrefs();
        await Storage.setPrefs({ ...prefs, pendingGuestName: guestName.trim() });
        if (!surveyorName) await setSurveyorName(guestName.trim());
        await setUser({ loggedIn: false });
        if (Platform.OS === 'web') window.alert(t.guest.offlineCreated);
        else Alert.alert(t.guest.offlineCreated);
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  };

  const lookupGuest = async () => {
    setError('');
    if (guestName.trim().length < 2) { setError(t.guest.errName); return; }
    setLoading(true);
    try {
      const f = await fingerprint();
      const r = await Api.guestLookup(guestName.trim(), f.hash);
      setCandidates(r.candidates);
    } catch {
      setError(t.guest.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const openGuest = async () => {
    setError('');
    if (!/^\d{4}$/.test(guestPin)) { setError(t.guest.errPin); return; }
    if (!selected && !guestIdInput.trim()) { setError(t.guest.errBad); return; }
    setLoading(true);
    try {
      const f = await fingerprint();
      const u = await Api.guestLogin({
        pin: guestPin,
        ref: selected?.ref,
        guest_id: selected ? undefined : guestIdInput.trim().toUpperCase(),
        device_hash: f.hash,
        device_label: f.label,
      });
      const restored = await finalizeGuest(u, guestPin);
      const msg = `✅ ${u.name}\n${restored} ${t.guest.restored}`;
      if (Platform.OS === 'web') window.alert(msg);
      router.replace('/(tabs)');
    } catch (e: any) {
      const m = String(e?.message || '');
      setError(m.includes('429') ? t.guest.errLocked
        : m.includes('401') ? t.guest.errBad
        : m.includes('400') ? t.guest.errPin
        : t.guest.errNetwork);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (what: 'id' | 'pin', value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const tref = useRef<any>(null);
  useEffect(() => {
    if (resendIn <= 0) return;
    tref.current = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tref.current);
  }, [resendIn]);

  const friendlyError = (e: any, ctx: 'login' | 'register'): string => {
    const msg = String(e?.message || '');
    if (msg.includes('API 401')) return ctx === 'login' ? t.auth.errBadCredentials : t.auth.errOtp;
    if (msg.includes('API 429')) return t.auth.errLocked;
    if (msg.includes('API 409')) return t.auth.errExists;
    if (msg.includes('API 400')) {
      return msg.toLowerCase().includes('pin') ? t.auth.errPin : msg.replace(/^API \d+:\s*/, '');
    }
    return t.auth.errNetwork;
  };

  const finalizeSession = async (u: AuthUser) => {
    await setUser({
      loggedIn: true, phone: u.phone, userId: u.user_id,
      name: u.name, efylId: u.efyl_id, token: u.token,
    });
    if (u.name && !surveyorName) await setSurveyorName(u.name);
    // Pull previously synced work from the server (best effort)
    try {
      const r = await restoreAccount(u.token);
      setRestoredCount(r.addresses);
      return r.addresses;
    } catch {
      setRestoredCount(0);
      return 0;
    }
  };

  // ---- Register flow ----
  const startRegisterOtp = async () => {
    setError('');
    if (!name.trim()) { setError(t.auth.errName); return; }
    if (!/^\d{4}$/.test(pin)) { setError(t.auth.errPin); return; }
    if (pin !== pin2) { setError(t.auth.errPinMismatch); return; }
    setLoading(true);
    try {
      const r = await Api.otpRequest(phone.trim());
      setDemoCode(r.demo_code || '');
      setIsRealSms(r.method === 'twilio');
      setMode('register-otp');
      setResendIn(60);
    } catch (e: any) {
      setError(friendlyError(e, 'register'));
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    setError('');
    setLoading(true);
    try {
      const u = await Api.register({ phone: phone.trim(), name: name.trim(), pin, code: code.trim() });
      setAccount(u);
      await finalizeSession(u);
      setMode('register-done');
    } catch (e: any) {
      setError(friendlyError(e, 'register'));
    } finally {
      setLoading(false);
    }
  };

  // ---- Login flow ----
  const submitLogin = async () => {
    setError('');
    if (!identifier.trim()) { setError(t.auth.errBadCredentials); return; }
    if (!/^\d{4}$/.test(loginPin)) { setError(t.auth.errPin); return; }
    setLoading(true);
    try {
      const u = await Api.login(identifier.trim(), loginPin);
      const restored = await finalizeSession(u);
      const msg = `✅ ${u.name || u.phone}\n${restored} ${t.auth.restoredMsg}`;
      if (Platform.OS === 'web') window.alert(msg);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(friendlyError(e, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const skip = async () => {
    await setUser({ loggedIn: false });
    router.replace('/(tabs)');
  };

  const backFrom = (m: Mode) => {
    if (m === 'register-otp') return 'register';
    if (m === 'guest-new' || m === 'guest-lookup') return 'guest-choice';
    if (m === 'guest-pin') return candidates ? 'guest-lookup' : 'guest-choice';
    if (m === 'register' || m === 'login' || m === 'guest-choice') return 'choice';
    return null;
  };

  const backTo = (m: Mode) => { setError(''); setMode(m); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              const target = backFrom(mode);
              if (target) backTo(target);
              else router.back();
            }}
            testID="auth-back-btn"
          >
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.auth.choiceTitle}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {mode === 'choice' && (
            <View testID="auth-choice">
              <View style={styles.iconCircle}>
                <Ionicons name="person-circle-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.hint}>{t.auth.choiceHint}</Text>
              {knownAccounts.length > 0 && (
                <View style={styles.resumeCard} testID="guest-device-known">
                  <View style={styles.resumeHead}>
                    <Ionicons name="phone-portrait-outline" size={16} color={Colors.primary} />
                    <Text style={styles.resumeTitle}>{t.guest.deviceKnownTitle}</Text>
                  </View>
                  <Text style={styles.resumeHint}>{t.guest.deviceKnownHint}</Text>
                  {knownAccounts.map((a) => (
                    <TouchableOpacity
                      key={a.ref}
                      style={styles.resumeRow}
                      onPress={() => { setSelected(a); setGuestPin(''); setCandidates(null); backTo('guest-pin'); }}
                      testID="guest-resume-btn"
                    >
                      <View style={styles.resumeAvatar}>
                        <Text style={styles.resumeAvatarTxt}>{(a.name || '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resumeName}>{a.name}</Text>
                        <Text style={styles.resumeMeta}>
                          {a.guest_id_masked} • {a.addresses_count} {t.guest.addressesCount}
                        </Text>
                      </View>
                      <Text style={styles.resumeCta}>{t.guest.resume}</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.bigCard} onPress={() => backTo('register')} testID="auth-register-card">
                <Ionicons name="person-add-outline" size={26} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigCardTitle}>{t.auth.registerCard}</Text>
                  <Text style={styles.bigCardDesc}>{t.auth.registerCardDesc}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bigCard} onPress={() => backTo('login')} testID="auth-login-card">
                <Ionicons name="key-outline" size={26} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigCardTitle}>{t.auth.loginCard}</Text>
                  <Text style={styles.bigCardDesc}>{t.auth.loginCardDesc}</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: Spacing.md }} />
              <Button
                label={t.auth.continueGuest}
                variant="secondary"
                onPress={() => { setCandidates(null); setSelected(null); backTo('guest-choice'); }}
                testID="guest-btn"
              />
            </View>
          )}

          {mode === 'register' && (
            <View testID="auth-register-form">
              <Text style={styles.fieldLabel}>{t.auth.nameLabel}</Text>
              <TextInput
                testID="reg-name" style={styles.input} value={name} onChangeText={setName}
                placeholder={t.auth.namePh} placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>{t.auth.phoneLabel}</Text>
              <TextInput
                testID="reg-phone" style={styles.input} value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" placeholder="+237 6XX XXX XXX" placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>{t.auth.pinLabel}</Text>
              <TextInput
                testID="reg-pin" style={[styles.input, styles.pinInput]} value={pin}
                onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} secureTextEntry
                placeholder="••••" placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>{t.auth.pinConfirmLabel}</Text>
              <TextInput
                testID="reg-pin2" style={[styles.input, styles.pinInput]} value={pin2}
                onChangeText={(v) => setPin2(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} secureTextEntry
                placeholder="••••" placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.pinHint}>🔒 {t.auth.pinHint}</Text>
              {!!error && <Text style={styles.error} testID="auth-error">{error}</Text>}
              <View style={{ height: Spacing.md }} />
              <Button label={t.auth.sendOtp} onPress={startRegisterOtp} loading={loading} testID="reg-send-otp-btn" />
            </View>
          )}

          {mode === 'register-otp' && (
            <View testID="auth-register-otp">
              <Text style={styles.stepTitle}>{t.auth.otpStepTitle}</Text>
              <Text style={styles.hint}>{phone}</Text>
              <TextInput
                testID="reg-otp-input"
                style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' }]}
                value={code} onChangeText={setCode}
                keyboardType="number-pad" maxLength={6}
                placeholder="••••••" placeholderTextColor={Colors.textTertiary}
              />
              {isRealSms ? (
                <Text style={[styles.demo, { color: Colors.success }]}>📱 {t.auth.realSms}</Text>
              ) : !!demoCode ? (
                <Text style={styles.demo}>{t.auth.demoNote} ({demoCode})</Text>
              ) : null}
              {!!error && <Text style={styles.error} testID="auth-error">{error}</Text>}
              <View style={{ height: Spacing.md }} />
              <Button label={t.auth.registerBtn} onPress={submitRegister} loading={loading} testID="reg-submit-btn" />
              <TouchableOpacity onPress={resendIn ? undefined : startRegisterOtp} style={{ alignSelf: 'center', marginTop: Spacing.md }}>
                <Text style={styles.resendTxt}>
                  {resendIn ? `${t.auth.resendIn} ${resendIn}s` : t.auth.sendOtp}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'register-done' && account && (
            <View testID="auth-register-done" style={{ alignItems: 'center' }}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0F9F4' }]}>
                <Ionicons name="checkmark-circle" size={44} color={Colors.success} />
              </View>
              <Text style={styles.stepTitle}>{t.auth.efylIdTitle}</Text>
              <View style={styles.efylIdBox} testID="efyl-id-box">
                <Text style={styles.efylIdTxt}>{account.efyl_id}</Text>
              </View>
              <Text style={styles.hint}>{t.auth.efylIdNote}</Text>
              {restoredCount !== null && restoredCount > 0 && (
                <Text style={styles.demo}>↩️ {restoredCount} {t.auth.restoredMsg}</Text>
              )}
              <View style={{ height: Spacing.lg }} />
              <Button
                label={t.auth.startBtn}
                variant="accent"
                onPress={() => router.replace('/(tabs)')}
                testID="reg-start-btn"
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          )}

          {mode === 'login' && (
            <View testID="auth-login-form">
              <Text style={styles.fieldLabel}>{t.auth.identifierLabel}</Text>
              <TextInput
                testID="login-identifier" style={styles.input} value={identifier} onChangeText={setIdentifier}
                autoCapitalize="characters" placeholder={t.auth.identifierPh} placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>{t.auth.pinLabel}</Text>
              <TextInput
                testID="login-pin" style={[styles.input, styles.pinInput]} value={loginPin}
                onChangeText={(v) => setLoginPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} secureTextEntry
                placeholder="••••" placeholderTextColor={Colors.textTertiary}
              />
              {!!error && <Text style={styles.error} testID="auth-error">{error}</Text>}
              <View style={{ height: Spacing.md }} />
              <Button label={loading ? t.auth.restoring : t.auth.loginBtn} onPress={submitLogin} loading={loading} testID="login-submit-btn" />
            </View>
          )}

          {/* ================= GUEST IDENTITY ================= */}
          {mode === 'guest-choice' && (
            <View testID="guest-choice">
              <View style={styles.iconCircle}>
                <Ionicons name="finger-print-outline" size={38} color={Colors.accent} />
              </View>
              <Text style={styles.hint}>{t.guest.choiceHint}</Text>
              {knownAccounts.length > 0 && (
                <View style={styles.resumeCard}>
                  <View style={styles.resumeHead}>
                    <Ionicons name="phone-portrait-outline" size={16} color={Colors.primary} />
                    <Text style={styles.resumeTitle}>{t.guest.deviceKnownTitle}</Text>
                  </View>
                  {knownAccounts.map((a) => (
                    <TouchableOpacity
                      key={a.ref}
                      style={styles.resumeRow}
                      onPress={() => { setSelected(a); setGuestPin(''); setCandidates(null); backTo('guest-pin'); }}
                      testID="guest-resume-btn-2"
                    >
                      <View style={styles.resumeAvatar}>
                        <Text style={styles.resumeAvatarTxt}>{(a.name || '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resumeName}>{a.name}</Text>
                        <Text style={styles.resumeMeta}>
                          {a.guest_id_masked} • {a.addresses_count} {t.guest.addressesCount}
                        </Text>
                      </View>
                      <Text style={styles.resumeCta}>{t.guest.resume}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.bigCard} onPress={() => { setGuestName(''); backTo('guest-new'); }} testID="guest-first-time-card">
                <Ionicons name="sparkles-outline" size={26} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigCardTitle}>{t.guest.firstTime}</Text>
                  <Text style={styles.bigCardDesc}>{t.guest.firstTimeDesc}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bigCard} onPress={() => { setCandidates(null); setSelected(null); backTo('guest-lookup'); }} testID="guest-already-card">
                <Ionicons name="search-outline" size={26} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigCardTitle}>{t.guest.already}</Text>
                  <Text style={styles.bigCardDesc}>{t.guest.alreadyDesc}</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: Spacing.sm }} />
              <Button label={t.guest.continueWithout} variant="ghost" onPress={skip} testID="guest-anon-btn" />
            </View>
          )}

          {mode === 'guest-new' && (
            <View testID="guest-new-form">
              <Text style={styles.stepTitle}>{t.guest.firstTime}</Text>
              <Text style={styles.hint}>{t.guest.firstTimeDesc}</Text>
              <Text style={styles.fieldLabel}>{t.guest.nameLabel}</Text>
              <TextInput
                testID="guest-name-input" style={styles.input} value={guestName}
                onChangeText={setGuestName} placeholder={t.guest.namePh}
                placeholderTextColor={Colors.textTertiary} autoCapitalize="words"
              />
              {!!error && <Text style={styles.error} testID="guest-error">{error}</Text>}
              <View style={{ height: Spacing.md }} />
              <Button label={t.guest.createBtn} variant="accent" onPress={createGuest} loading={loading} testID="guest-create-btn" />
            </View>
          )}

          {mode === 'guest-done' && created && (
            <View testID="guest-done" style={{ alignItems: 'center' }}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0F9F4' }]}>
                <Ionicons name="shield-checkmark" size={42} color={Colors.success} />
              </View>
              <Text style={styles.stepTitle}>{t.guest.createdTitle}</Text>
              <Text style={styles.hint}>{t.guest.createdHint}</Text>

              <View style={styles.credBox}>
                <Text style={styles.credLabel}>{t.guest.yourId}</Text>
                <Text style={styles.credValue} testID="guest-id-value">{created.guest_id}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={() => copy('id', created.guest_id)} testID="guest-copy-id">
                  <Ionicons name={copied === 'id' ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                  <Text style={styles.copyTxt}>{copied === 'id' ? t.guest.copied : t.guest.copyBtn}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.credBox, { borderColor: Colors.accent }]}>
                <Text style={styles.credLabel}>{t.guest.yourPin}</Text>
                <Text style={[styles.credValue, { color: Colors.accent, letterSpacing: 8 }]} testID="guest-pin-value">
                  {created.pin}
                </Text>
                <TouchableOpacity style={styles.copyBtn} onPress={() => copy('pin', created.pin || '')} testID="guest-copy-pin">
                  <Ionicons name={copied === 'pin' ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                  <Text style={styles.copyTxt}>{copied === 'pin' ? t.guest.copied : t.guest.copyBtn}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.pinHint}>{t.guest.savedLocally}</Text>
              <Text style={styles.pinHint}>⚠️ {t.guest.pinReminder}</Text>
              <View style={{ height: Spacing.lg }} />
              <Button
                label={t.guest.startBtn}
                variant="accent"
                onPress={() => router.replace('/(tabs)')}
                testID="guest-start-btn"
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          )}

          {mode === 'guest-lookup' && (
            <View testID="guest-lookup-form">
              <Text style={styles.stepTitle}>{t.guest.searchTitle}</Text>
              <Text style={styles.hint}>{t.guest.searchHint}</Text>
              <Text style={styles.fieldLabel}>{t.guest.nameLabel}</Text>
              <TextInput
                testID="guest-lookup-input" style={styles.input} value={guestName}
                onChangeText={setGuestName} placeholder={t.guest.namePh}
                placeholderTextColor={Colors.textTertiary} autoCapitalize="words"
                onSubmitEditing={lookupGuest} returnKeyType="search"
              />
              {!!error && <Text style={styles.error} testID="guest-error">{error}</Text>}
              <View style={{ height: Spacing.sm }} />
              <Button label={t.guest.searchBtn} onPress={lookupGuest} loading={loading} testID="guest-lookup-btn" />

              {candidates !== null && candidates.length > 0 && (
                <View style={{ marginTop: Spacing.lg }}>
                  <Text style={styles.fieldLabel}>{t.guest.candidatesTitle}</Text>
                  {candidates.map((c) => (
                    <TouchableOpacity
                      key={c.ref}
                      style={styles.candRow}
                      onPress={() => { setSelected(c); setGuestPin(''); backTo('guest-pin'); }}
                      testID="guest-candidate"
                    >
                      <View style={styles.resumeAvatar}>
                        <Text style={styles.resumeAvatarTxt}>{(c.name || '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resumeName}>{c.name}</Text>
                        <Text style={styles.resumeMeta}>
                          {c.guest_id_masked} • {c.addresses_count} {t.guest.addressesCount}
                        </Text>
                        {!!c.last_login && (
                          <Text style={styles.resumeMeta}>
                            {t.guest.lastUse}: {new Date(c.last_login).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      {c.same_device && (
                        <View style={styles.sameDevicePill}>
                          <Text style={styles.sameDeviceTxt}>{t.guest.sameDevice}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => { setSelected(null); setGuestPin(''); backTo('guest-pin'); }} testID="guest-use-id-btn">
                    <Text style={styles.resendTxt}>{t.guest.idLabel} →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {candidates !== null && candidates.length === 0 && (
                <View style={{ marginTop: Spacing.lg }} testID="guest-no-candidate">
                  <Text style={styles.demo}>{t.guest.noCandidate}</Text>
                  <Text style={styles.hint}>{t.guest.noCandidateHint}</Text>
                  <Button label={t.guest.createInstead} variant="accent" onPress={createGuest} loading={loading} testID="guest-create-instead-btn" />
                  <View style={{ height: Spacing.sm }} />
                  <TouchableOpacity onPress={() => { setSelected(null); setGuestPin(''); backTo('guest-pin'); }} testID="guest-use-id-btn-2">
                    <Text style={styles.resendTxt}>{t.guest.idLabel} →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {mode === 'guest-pin' && (
            <View testID="guest-pin-form">
              <Text style={styles.stepTitle}>{t.guest.pinTitle}</Text>
              {selected ? (
                <Text style={styles.hint}>
                  {selected.name} • {selected.guest_id_masked}
                </Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{t.guest.idLabel}</Text>
                  <TextInput
                    testID="guest-id-input" style={styles.input} value={guestIdInput}
                    onChangeText={setGuestIdInput} placeholder={t.guest.idPh}
                    placeholderTextColor={Colors.textTertiary} autoCapitalize="characters"
                  />
                </>
              )}
              <Text style={styles.fieldLabel}>{t.guest.pinTitle}</Text>
              <TextInput
                testID="guest-pin-input" style={[styles.input, styles.pinInput]} value={guestPin}
                onChangeText={(v) => setGuestPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} secureTextEntry
                placeholder="••••" placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.pinHint}>{t.guest.pinHint}</Text>
              {!!error && <Text style={styles.error} testID="guest-error">{error}</Text>}
              <View style={{ height: Spacing.md }} />
              <Button label={loading ? t.auth.restoring : t.guest.openBtn} onPress={openGuest} loading={loading} testID="guest-open-btn" />
              {!!selected && (
                <TouchableOpacity
                  onPress={() => { setSelected(null); setError(''); backTo('guest-lookup'); }}
                  style={{ alignSelf: 'center', marginTop: Spacing.md }}
                  testID="guest-not-me-btn"
                >
                  <Text style={styles.resendTxt}>{t.guest.notMe}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 60 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.md },
  hint: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22 },
  bigCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.divider, ...Shadows.card,
  },
  bigCardTitle: { ...Typography.h3, fontSize: 16 },
  bigCardDesc: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  stepTitle: { ...Typography.h2, fontSize: 20, textAlign: 'center', marginBottom: Spacing.sm },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52, fontFamily: 'DMSans_500Medium', fontSize: 16, color: Colors.textPrimary, ...Shadows.card },
  pinInput: { letterSpacing: 12, textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold', fontSize: 20 },
  pinHint: { ...Typography.caption, color: Colors.textTertiary, marginTop: Spacing.sm, lineHeight: 16 },
  demo: { ...Typography.bodySm, color: Colors.accent, marginTop: 8, fontFamily: 'DMSans_500Medium', textAlign: 'center' },
  error: { ...Typography.bodySm, color: Colors.error, marginTop: Spacing.sm, textAlign: 'center', fontFamily: 'DMSans_700Bold' },
  resendTxt: { ...Typography.label, color: Colors.primary },
  efylIdBox: {
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    marginVertical: Spacing.md, ...Shadows.card,
  },
  efylIdTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 26, color: Colors.primary, letterSpacing: 2 },
  resumeCard: {
    backgroundColor: '#E7F3EC', borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, gap: 8,
  },
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resumeTitle: { ...Typography.label, color: Colors.primary, fontFamily: 'DMSans_700Bold', flex: 1 },
  resumeHint: { ...Typography.caption, color: Colors.primary },
  resumeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm,
  },
  resumeAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  resumeAvatarTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  resumeName: { ...Typography.label, fontFamily: 'DMSans_700Bold' },
  resumeMeta: { ...Typography.caption, color: Colors.textSecondary },
  resumeCta: { ...Typography.caption, color: Colors.primary, fontFamily: 'DMSans_700Bold' },
  candRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.divider,
  },
  sameDevicePill: {
    backgroundColor: Colors.success, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sameDeviceTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 9 },
  credBox: {
    alignSelf: 'stretch', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, marginTop: Spacing.sm, ...Shadows.card,
  },
  credLabel: { ...Typography.caption, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 24, color: Colors.primary, letterSpacing: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10 },
  copyTxt: { ...Typography.caption, color: Colors.primary, fontFamily: 'DMSans_700Bold' },
});
