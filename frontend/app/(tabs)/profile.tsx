import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Storage } from '../../src/services/storage';
import { Button } from '../../src/components/Button';
import { Api } from '../../src/services/api';

export default function ProfileTab() {
  const {
    t, language, setLanguage, user, setUser,
    addresses, syncQueueCount, lastSync, syncNow, isOnline,
  } = useApp();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const surveyCount = addresses.filter((a) => a.has_survey).length;

  const onSync = async () => {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    const msg = r ? `Synced ${r.synced} items` : 'Sync failed';
    if (Platform.OS === 'web') alert(msg); else Alert.alert(msg);
  };

  const onLogout = async () => { await setUser({ loggedIn: false }); };

  const onResetData = async () => {
    const doIt = async () => {
      await Storage.clearAll();
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete all local data?')) doIt();
    } else {
      Alert.alert('Delete', 'Delete all local data?', [
        { text: t.common.cancel, style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  const onExport = async (kind: 'csv' | 'json') => {
    const url = kind === 'csv' ? Api.exportCsvUrl() : Api.exportJsonUrl();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Export', "Impossible d'ouvrir le lien d'export.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.title}>{t.profile.title}</Text>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(user.phone || 'GU').slice(-2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.loggedIn ? user.phone : t.profile.guest}</Text>
            <Text style={styles.userMeta}>
              {addresses.length} {t.profile.addressesCreated} • {surveyCount} {t.profile.surveysSubmitted}
            </Text>
          </View>
          {!user.loggedIn ? (
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.smallBtn} testID="goto-login-btn">
              <Text style={styles.smallBtnTxt}>{t.profile.login}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onLogout} style={[styles.smallBtn, { backgroundColor: Colors.surface }]} testID="logout-btn">
              <Text style={[styles.smallBtnTxt, { color: Colors.textPrimary }]}>{t.profile.logout}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Section title={t.profile.language}>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.langChip, language === 'fr' && styles.langChipActive]} onPress={() => setLanguage('fr')} testID="profile-lang-fr">
              <Text style={[styles.langTxt, language === 'fr' && styles.langTxtActive]}>Français</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.langChip, language === 'en' && styles.langChipActive]} onPress={() => setLanguage('en')} testID="profile-lang-en">
              <Text style={[styles.langTxt, language === 'en' && styles.langTxtActive]}>English</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title={t.profile.sync}>
          <View style={styles.syncIndicator}>
            <View style={[styles.dot, { backgroundColor: isOnline ? Colors.success : Colors.error }]} />
            <Text style={styles.metaTxt}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
          <Text style={styles.metaTxt}>
            {syncQueueCount > 0
              ? `${syncQueueCount} ${t.profile.pendingSync}`
              : (lastSync ? `${t.profile.lastSynced}: ${new Date(lastSync).toLocaleString()}` : '—')}
          </Text>
          <Text style={styles.autoSyncHint}>✨ {t.profile.autoSync}</Text>
          <View style={{ height: Spacing.sm }} />
          <Button label={t.profile.syncNow} onPress={onSync} loading={syncing} testID="sync-now-btn" />
        </Section>

        <Section title="Export">
          <Button
            label={t.profile.exportData}
            variant="secondary"
            onPress={() => onExport('csv')}
            testID="export-csv-btn"
          />
          <View style={{ height: 8 }} />
          <Button
            label={t.profile.exportJson}
            variant="ghost"
            onPress={() => onExport('json')}
            testID="export-json-btn"
          />
        </Section>

        <Section title={t.profile.privacy}>
          <TouchableOpacity style={styles.linkRow} onPress={onResetData} testID="reset-data-btn">
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={[styles.linkTxt, { color: Colors.error }]}>{t.profile.deleteData}</Text>
          </TouchableOpacity>
        </Section>

        <Section title={t.profile.about}>
          <Text style={styles.metaTxt}>EFYL AddressBook — v2.0.0</Text>
          <Text style={styles.metaTxt}>EFYL GmbH • Niddatal, Germany</Text>
          <Text style={styles.metaTxt}>Pilot: Bonamoussadi, Douala, Cameroun</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { ...Typography.h1, marginBottom: Spacing.lg },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.lg, ...Shadows.card },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  avatarTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 20 },
  userName: { ...Typography.h3 },
  userMeta: { ...Typography.bodySm, color: Colors.textSecondary, marginTop: 2 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.primary },
  smallBtnTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  sectionBody: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, ...Shadows.card },
  row: { flexDirection: 'row', gap: Spacing.sm },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.divider },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langTxt: { fontFamily: 'DMSans_500Medium', color: Colors.textSecondary },
  langTxtActive: { color: Colors.white },
  metaTxt: { ...Typography.body, color: Colors.textSecondary, marginBottom: 2 },
  syncIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  autoSyncHint: { ...Typography.caption, color: Colors.primary, marginTop: 4, fontFamily: 'DMSans_500Medium' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  linkTxt: { ...Typography.label },
});
