import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Api } from '../src/services/api';
import { Button } from '../src/components/Button';

export default function Login() {
  const router = useRouter();
  const { t, setUser } = useApp();
  const [phone, setPhone] = useState('+237 6');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const tref = useRef<any>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    tref.current = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tref.current);
  }, [resendIn]);

  const send = async () => {
    setLoading(true);
    try {
      const r = await Api.otpRequest(phone.trim());
      setDemoCode(r.demo_code || '');
      setStep('otp');
      setResendIn(60);
    } catch (e: any) {
      const msg = e?.message || 'Network error';
      if (Platform.OS === 'web') alert(msg); else Alert.alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      const r = await Api.otpVerify(phone.trim(), code.trim());
      await setUser({ loggedIn: true, phone: r.phone, userId: r.user_id });
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.message || 'Invalid code';
      if (Platform.OS === 'web') alert(msg); else Alert.alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const skip = async () => {
    await setUser({ loggedIn: false });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.auth.title}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait" size={36} color={Colors.primary} />
          </View>

          {step === 'phone' && (
            <>
              <Text style={styles.fieldLabel}>{t.auth.phoneLabel}</Text>
              <TextInput
                testID="phone-input"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+237 6XX XXX XXX"
                placeholderTextColor={Colors.textTertiary}
              />
              <View style={{ height: Spacing.md }} />
              <Button label={t.auth.sendOtp} onPress={send} loading={loading} testID="send-otp-btn" />
              <View style={{ height: Spacing.sm }} />
              <Button label={t.auth.continueGuest} variant="ghost" onPress={skip} testID="guest-btn" />
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.fieldLabel}>{t.auth.otpLabel}</Text>
              <TextInput
                testID="otp-input"
                style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' }]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={Colors.textTertiary}
              />
              {!!demoCode && (
                <Text style={styles.demo}>{t.auth.demoNote} ({demoCode})</Text>
              )}
              <View style={{ height: Spacing.md }} />
              <Button label={t.auth.verify} onPress={verify} loading={loading} testID="verify-otp-btn" />
              <TouchableOpacity onPress={resendIn ? undefined : send} style={{ alignSelf: 'center', marginTop: Spacing.md }}>
                <Text style={styles.resendTxt}>
                  {resendIn ? `${t.auth.resendIn} ${resendIn}s` : t.auth.sendOtp}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  title: { ...Typography.h2 },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.xl },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52, fontFamily: 'DMSans_500Medium', fontSize: 16, color: Colors.textPrimary, ...Shadows.card },
  demo: { ...Typography.bodySm, color: Colors.accent, marginTop: 8, fontFamily: 'DMSans_500Medium', textAlign: 'center' },
  resendTxt: { ...Typography.label, color: Colors.primary },
});
