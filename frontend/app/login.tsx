import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Api } from '../src/services/api';
import type { AuthUser } from '../src/services/api';
import { Button } from '../src/components/Button';

type Mode = 'choice' | 'register' | 'register-otp' | 'register-done' | 'login';

export default function Login() {
  const router = useRouter();
  const { t, setUser, restoreAccount, surveyorName, setSurveyorName } = useApp();
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

  const backTo = (m: Mode) => { setError(''); setMode(m); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (mode === 'register-otp') backTo('register');
              else if (mode === 'register' || mode === 'login') backTo('choice');
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
              <Button label={t.auth.continueGuest} variant="ghost" onPress={skip} testID="guest-btn" />
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
});
