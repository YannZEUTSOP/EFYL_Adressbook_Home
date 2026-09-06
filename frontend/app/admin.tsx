// Admin dashboard — real-time tracking of surveyors and collected data.
// PIN-protected; data comes from the server (all surveyors combined).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, Radius, Shadows, Spacing, Typography } from '../src/theme';
import { useApp } from '../src/contexts/AppContext';
import { Api } from '../src/services/api';

const PIN_KEY = 'efyl:admin_pin';

export default function AdminScreen() {
  const { t } = useApp();
  const router = useRouter();

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<{ address: any; survey: any } | null>(null);
  const [searchErr, setSearchErr] = useState(false);
  const [searching, setSearching] = useState(false);

  // CSV import (matricules + exact navigation points)
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState<any | null>(null);
  const [importErr, setImportErr] = useState('');

  const pickCsv = async () => {
    setImportErr('');
    setImportRes(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const text = Platform.OS === 'web'
        ? await (await fetch(asset.uri)).text()
        : await FileSystem.readAsStringAsync(asset.uri);
      setCsvText(text);
      setCsvName(asset.name || 'import.csv');
    } catch (e: any) {
      setImportErr(String(e?.message || e));
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!csvText) return;
    setImporting(true);
    setImportErr('');
    setImportRes(null);
    try {
      setImportRes(await Api.adminImportMatricules(pin, csvText, dryRun));
    } catch (e: any) {
      setImportErr(String(e?.message || e).replace(/^API \d+:\s*/, ''));
    } finally {
      setImporting(false);
    }
  };

  const doSearch = async () => {
    const q = searchQ.trim().toUpperCase();
    if (!q) return;
    setSearching(true);
    setSearchErr(false);
    setSearchRes(null);
    try {
      const r = await Api.adminAddressFull(pin, q);
      setSearchRes(r);
    } catch {
      setSearchErr(true);
    } finally {
      setSearching(false);
    }
  };

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setPinError(false);
    try {
      const [ov, list] = await Promise.all([
        Api.adminOverview(p),
        Api.adminAddresses(p, 100),
      ]);
      setOverview(ov);
      setRecent(list);
      setUnlocked(true);
      await AsyncStorage.setItem(PIN_KEY, p);
    } catch {
      setPinError(true);
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (saved) {
        setPin(saved);
        load(saved);
      }
    })();
  }, [load]);

  const lock = async () => {
    await AsyncStorage.removeItem(PIN_KEY);
    setUnlocked(false);
    setOverview(null);
    setPin('');
  };

  const fmtTime = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
  };

  const typeIcon = (a: any) =>
    a.is_heritage ? '🏞️' : a.is_public ? '🏛️' : a.is_commerce ? '🏪' : '🏠';

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="admin-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="admin-back">
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t.admin.title}</Text>
        </View>
        <View style={styles.pinBox}>
          <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          <Text style={styles.pinLabel}>{t.admin.pinLabel}</Text>
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(v) => { setPin(v); setPinError(false); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            testID="admin-pin-input"
          />
          {pinError && <Text style={styles.pinError}>{t.admin.pinError}</Text>}
          <TouchableOpacity
            style={[styles.pinBtn, (!pin || loading) && { opacity: 0.5 }]}
            disabled={!pin || loading}
            onPress={() => load(pin)}
            testID="admin-pin-submit"
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <Text style={styles.pinBtnTxt}>{t.admin.pinBtn}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ov = overview || {};
  const byType = ov.by_type || {};
  const users: any[] = ov.users || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="admin-dashboard">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="admin-back">
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.admin.title}</Text>
          <Text style={styles.subtitle}>{t.admin.subtitle}</Text>
        </View>
        <TouchableOpacity onPress={lock} style={styles.lockBtn} testID="admin-lock">
          <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.lockTxt}>{t.admin.lock}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(pin)} />}
      >
        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <StatCard value={ov.total_addresses ?? 0} label={t.admin.total} color={Colors.primary} testID="stat-total" />
          <StatCard value={ov.today_count ?? 0} label={t.admin.today} color={Colors.accent} testID="stat-today" />
          <StatCard value={ov.week_count ?? 0} label={t.admin.week} color="#8B5CF6" testID="stat-week" />
          <StatCard value={ov.active_users_24h ?? 0} label={t.admin.active24h} color="#0EA5E9" testID="stat-active" />
          <StatCard value={ov.surveys_count ?? 0} label={t.admin.surveys} color="#DB2777" testID="stat-surveys" />
          <StatCard value={ov.persons_count ?? 0} label={t.admin.persons} color="#F59E0B" testID="stat-persons" />
        </View>

        {/* Types */}
        <Text style={styles.sectionTitle}>{t.admin.types}</Text>
        <View style={styles.typesCard}>
          <TypeRow emoji="🏠" label={t.admin.households} value={byType.household ?? 0} />
          <TypeRow emoji="🏪" label={t.admin.commerces} value={byType.commerce ?? 0} />
          <TypeRow emoji="🏛️" label={t.admin.publics} value={byType.public ?? 0} />
          <TypeRow emoji="🏞️" label={t.admin.heritages} value={byType.heritage ?? 0} />
        </View>

        {/* Surveyors */}
        <Text style={styles.sectionTitle}>{t.admin.usersTitle} ({users.length})</Text>
        {users.length === 0 && <Text style={styles.noData}>{t.admin.noData}</Text>}
        {users.map((u) => (
          <View key={u.owner_id} style={styles.userCard} testID={`admin-user-${u.owner_id}`}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarTxt}>
                {(u.owner_name || '?').trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.owner_name || t.admin.anonymous}</Text>
              <Text style={styles.userMeta}>{u.owner_id}</Text>
              <Text style={styles.userMeta}>{t.admin.lastActivity}: {fmtTime(u.last_activity)}</Text>
            </View>
            <View style={styles.userStats}>
              <Text style={styles.userStatBig}>{u.today}</Text>
              <Text style={styles.userStatLbl}>{t.admin.colToday}</Text>
            </View>
            <View style={styles.userStats}>
              <Text style={styles.userStatBig}>{u.total}</Text>
              <Text style={styles.userStatLbl}>{t.admin.colTotal}</Text>
            </View>
          </View>
        ))}

        {/* Export */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => {
            const url = Api.adminExportCsvUrl(pin);
            if (Platform.OS === 'web') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => {});
          }}
          testID="admin-export-btn"
        >
          <Ionicons name="download-outline" size={18} color={Colors.white} />
          <Text style={styles.exportTxt}>{t.admin.exportAll}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: Colors.accent, marginTop: 8 }]}
          onPress={() => {
            const url = Api.adminExportEnrichedCsvUrl(pin);
            if (Platform.OS === 'web') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => {});
          }}
          testID="admin-export-enriched-btn"
        >
          <Ionicons name="sparkles-outline" size={18} color={Colors.white} />
          <Text style={styles.exportTxt}>{t.admin.exportEnriched}</Text>
        </TouchableOpacity>
        <Text style={styles.enrichedHint}>{t.admin.exportEnrichedHint}</Text>

        {/* Import matricules / navigation points (CSV from the mapping partner) */}
        <Text style={styles.sectionTitle}>📥 {t.admin.importTitle}</Text>
        <View style={styles.importCard}>
          <Text style={styles.importHint}>{t.admin.importHint}</Text>
          <TouchableOpacity style={styles.importPickBtn} onPress={pickCsv} testID="admin-import-pick">
            <Ionicons name="document-attach-outline" size={18} color={Colors.primary} />
            <Text style={styles.importPickTxt}>{csvName || t.admin.importPick}</Text>
          </TouchableOpacity>
          {!!csvText && (
            <View style={styles.importActions}>
              <TouchableOpacity
                style={[styles.importBtn, { backgroundColor: Colors.surface }]}
                onPress={() => runImport(true)}
                disabled={importing}
                testID="admin-import-dry"
              >
                <Text style={[styles.importBtnTxt, { color: Colors.textPrimary }]}>{t.admin.importDry}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={() => runImport(false)}
                disabled={importing}
                testID="admin-import-run"
              >
                {importing ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.importBtnTxt}>{t.admin.importRun}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {!!importErr && (
            <Text style={[styles.importHint, { color: Colors.error }]} testID="admin-import-error">
              {t.admin.importError}: {importErr}
            </Text>
          )}
          {!!importRes && (
            <View style={styles.importResult} testID="admin-import-result">
              <Text style={styles.importResTitle}>
                {importRes.dry_run ? `${t.admin.importDry} — ${t.admin.importDone}` : t.admin.importDone}
              </Text>
              <Text style={styles.importResLine}>{importRes.rows_read} {t.admin.importRows}</Text>
              <Text style={styles.importResLine}>{importRes.addresses_matched} {t.admin.importMatched}</Text>
              <Text style={styles.importResLine}>{importRes.matricules_set} {t.admin.importMat}</Text>
              <Text style={styles.importResLine}>{importRes.nav_points_set} {t.admin.importNav}</Text>
              {!!importRes.not_found_count && (
                <Text style={[styles.importResLine, { color: Colors.gpsYellow }]}>
                  {importRes.not_found_count} {t.admin.importNotFound}: {(importRes.not_found_sample || []).slice(0, 5).join(', ')}…
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Search one building — full record (survey answers + persons + places) */}
        <Text style={styles.sectionTitle}>🔍 {t.admin.searchTitle}</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder={t.admin.searchPh}
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="characters"
            testID="admin-search-input"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={doSearch} disabled={searching} testID="admin-search-btn">
            {searching ? <ActivityIndicator color={Colors.white} size="small" /> : (
              <Ionicons name="search" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
        {searchErr && <Text style={[styles.noData, { color: Colors.error }]} testID="admin-search-notfound">{t.admin.searchNotFound}</Text>}
        {searchRes && (
          <View style={styles.recordCard} testID="admin-record">
            <Text style={styles.recordTitle}>{typeIcon(searchRes.address)} {searchRes.address.address_id}</Text>
            <Text style={styles.recordSection}>📍 {t.admin.recAddress}</Text>
            <Text style={styles.recordLine}>{searchRes.address.district} • {searchRes.address.sector}-{searchRes.address.street_id}-{searchRes.address.house_number}</Text>
            <Text style={styles.recordLine}>GPS: {searchRes.address.latitude?.toFixed?.(6)}, {searchRes.address.longitude?.toFixed?.(6)} (±{searchRes.address.accuracy_meters} m)</Text>
            <Text style={styles.recordLine}>🧭 Azimut: {searchRes.address.azimuth_degrees ?? '—'}°  •  📸 {searchRes.address.photos_count ?? 0} photo(s)</Text>
            {!!searchRes.address.contact_name && <Text style={styles.recordLine}>👤 {searchRes.address.contact_name} {searchRes.address.contact_phone ? `• ${searchRes.address.contact_phone}` : ''}</Text>}
            <Text style={styles.recordLine}>✍️ {searchRes.address.owner_name || searchRes.address.owner_id} • {fmtTime(searchRes.address.created_at)}</Text>
            {searchRes.survey ? (
              <>
                <Text style={styles.recordSection}>📋 {t.admin.recSurvey} — {searchRes.survey.survey_type}</Text>
                {searchRes.survey.survey_type === 'household' && (
                  <>
                    <Text style={styles.recordLine}>👪 {searchRes.survey.family_name} • {searchRes.survey.total_persons} pers. déclarées</Text>
                    <Text style={styles.recordLine}>💰 {searchRes.survey.main_income_source} ({searchRes.survey.income_level})</Text>
                    <Text style={styles.recordLine}>⚡ {searchRes.survey.electricity} • 💧 {searchRes.survey.water} • 🌐 {searchRes.survey.has_internet ? 'oui' : 'non'} • 📱 {searchRes.survey.num_phones}</Text>
                    <Text style={styles.recordLine}>🚽 {searchRes.survey.toilets} • 🍳 {searchRes.survey.kitchen_position} • 🧱 {searchRes.survey.wall_materials} • 🏠 {searchRes.survey.roof_materials}</Text>
                    <Text style={styles.recordLine}>🛋️ {searchRes.survey.num_living_rooms} pièce(s) • {searchRes.survey.num_floors} niveau(x)</Text>
                    <Text style={styles.recordLine}>🚲 {searchRes.survey.vehicles_bicycles} • 🏍️ {searchRes.survey.vehicles_motorcycles} • 🚗 {searchRes.survey.vehicles_cars} • 🚚 {searchRes.survey.vehicles_trucks}</Text>
                  </>
                )}
                {searchRes.survey.survey_type === 'commerce' && searchRes.survey.commerce && (
                  <>
                    <Text style={styles.recordLine}>🏪 {searchRes.survey.commerce.name} — {searchRes.survey.commerce.owner}</Text>
                    <Text style={styles.recordLine}>🛒 {searchRes.survey.commerce.products}</Text>
                    <Text style={styles.recordLine}>👷 {searchRes.survey.commerce.workers ?? '—'} travailleur(s) • 📞 {searchRes.survey.commerce.phone || '—'}</Text>
                    <Text style={styles.recordLine}>🕐 Sem: {searchRes.survey.commerce.hours_weekdays || '—'} • Sam: {searchRes.survey.commerce.hours_saturday || '—'} • Dim: {searchRes.survey.commerce.hours_sunday || '—'}</Text>
                  </>
                )}
                {searchRes.survey.survey_type === 'public' && searchRes.survey.public_service && (
                  <>
                    <Text style={styles.recordLine}>🏛️ {searchRes.survey.public_service.name} ({searchRes.survey.public_service.category})</Text>
                    <Text style={styles.recordLine}>🏢 {searchRes.survey.public_service.managing_org || '—'} • 📞 {searchRes.survey.public_service.phone || '—'}</Text>
                    <Text style={styles.recordLine}>👷 {searchRes.survey.public_service.workers ?? '—'} • 📊 Max: {searchRes.survey.public_service.capacity_max || '—'} • 📈 Actuel: {searchRes.survey.public_service.usage_current || '—'}</Text>
                    <Text style={styles.recordLine}>🕐 {searchRes.survey.public_service.hours || '—'}</Text>
                  </>
                )}
                {searchRes.survey.survey_type === 'heritage' && searchRes.survey.heritage && (
                  <>
                    <Text style={styles.recordLine}>🏞️ {searchRes.survey.heritage.name} ({searchRes.survey.heritage.kind} / {searchRes.survey.heritage.category})</Text>
                    <Text style={styles.recordLine}>🎟️ {searchRes.survey.heritage.access} {searchRes.survey.heritage.entry_fee ? `— ${searchRes.survey.heritage.entry_fee}` : ''} • 🕐 {searchRes.survey.heritage.hours || '—'}</Text>
                  </>
                )}
                {(searchRes.survey.persons || []).length > 0 && (
                  <>
                    <Text style={styles.recordSection}>👥 {t.admin.recPersons} ({searchRes.survey.persons.length})</Text>
                    {searchRes.survey.persons.map((p: any, i: number) => (
                      <View key={i} style={styles.recordPerson}>
                        <Text style={styles.recordLine}>
                          {i + 1}. {p.name} • {p.age} ans • {p.gender} • {p.education} • {p.profession || '—'}
                        </Text>
                        <Text style={styles.recordPlaces}>
                          ↳ {t.admin.recPlaces}: {p.no_places ? 'ne se déplace pas' : (p.places || []).length
                            ? (p.places || []).map((pl: any) => `${pl.name} (${pl.category}, ${pl.frequency}${pl.reason ? `, ${pl.reason}` : ''})`).join(' ; ')
                            : t.admin.recNone}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : (
              <Text style={[styles.recordLine, { color: Colors.error }]}>{t.admin.recNoSurvey}</Text>
            )}
          </View>
        )}

        {/* Recent addresses */}
        <Text style={styles.sectionTitle}>{t.admin.recent}</Text>
        {recent.map((a) => (
          <View key={`${a.owner_id}-${a.address_id}`} style={styles.addrRow} testID={`admin-addr-${a.address_id}`}>
            <Text style={styles.addrEmoji}>{typeIcon(a)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrId}>{a.address_id}</Text>
              <Text style={styles.addrMeta}>
                {a.survey_name || a.contact_name || a.district} • {a.owner_name || a.owner_id}
              </Text>
            </View>
            <Text style={styles.addrTime}>{fmtTime(a.created_at)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard: React.FC<{ value: number; label: string; color: string; testID?: string }> = ({ value, label, color, testID }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]} testID={testID}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const TypeRow: React.FC<{ emoji: string; label: string; value: number }> = ({ emoji, label, value }) => (
  <View style={styles.typeRow}>
    <Text style={styles.typeEmoji}>{emoji}</Text>
    <Text style={styles.typeLabel}>{label}</Text>
    <Text style={styles.typeValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  backBtn: { marginRight: Spacing.sm, padding: 4 },
  title: { ...Typography.h2 },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  lockTxt: { ...Typography.caption, color: Colors.textSecondary },
  pinBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: Spacing.xl },
  pinLabel: { ...Typography.label, color: Colors.textSecondary },
  pinInput: {
    width: 180, height: 52, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold', fontSize: 22,
    color: Colors.textPrimary, letterSpacing: 6,
  },
  pinError: { ...Typography.bodySm, color: Colors.error },
  pinBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 40, paddingVertical: 13,
  },
  pinBtnTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 15 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: Spacing.lg, marginTop: Spacing.sm,
  },
  statCard: {
    width: '30%', flexGrow: 1,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderLeftWidth: 4, padding: Spacing.md, ...Shadows.card,
  },
  statValue: { fontFamily: 'DMSans_700Bold', fontSize: 24 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...Typography.h3, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  typesCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, padding: Spacing.md, gap: 10, ...Shadows.card,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeEmoji: { fontSize: 18 },
  typeLabel: { ...Typography.bodySm, color: Colors.textPrimary, flex: 1 },
  typeValue: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: Colors.primary },
  noData: { ...Typography.bodySm, color: Colors.textTertiary, marginHorizontal: Spacing.lg },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginBottom: 8,
    padding: Spacing.md, ...Shadows.card,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F3ED', alignItems: 'center', justifyContent: 'center',
  },
  userAvatarTxt: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: Colors.primary },
  userName: { ...Typography.label, color: Colors.textPrimary },
  userMeta: { ...Typography.caption, color: Colors.textSecondary },
  userStats: { alignItems: 'center', minWidth: 44 },
  userStatBig: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: Colors.primary },
  userStatLbl: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginTop: Spacing.lg, paddingVertical: 14,
  },
  exportTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 15 },
  enrichedHint: { ...Typography.caption, color: Colors.textTertiary, marginHorizontal: Spacing.lg, marginTop: 6, lineHeight: 15 },
  importCard: {
    backgroundColor: Colors.card, marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.card,
  },
  importHint: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 16 },
  importPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: Spacing.md,
  },
  importPickTxt: { ...Typography.label, color: Colors.primary, flex: 1 },
  importActions: { flexDirection: 'row', gap: Spacing.sm },
  importBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  importBtnTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  importResult: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, gap: 2 },
  importResTitle: { ...Typography.label, fontFamily: 'DMSans_700Bold', marginBottom: 2 },
  importResLine: { ...Typography.caption, color: Colors.textSecondary },
  searchRow: {
    flexDirection: 'row', gap: 8, marginHorizontal: Spacing.lg, alignItems: 'center',
  },
  searchInput: {
    flex: 1, height: 46, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13, color: Colors.textPrimary,
  },
  searchBtn: {
    width: 46, height: 46, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  recordCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    padding: Spacing.md, ...Shadows.card, borderWidth: 1, borderColor: Colors.divider,
  },
  recordTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 15, color: Colors.primary },
  recordSection: { ...Typography.label, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: 2 },
  recordLine: { ...Typography.bodySm, color: Colors.textSecondary, lineHeight: 19 },
  recordPerson: { marginBottom: 6 },
  recordPlaces: { ...Typography.caption, color: Colors.textTertiary, paddingLeft: 12, lineHeight: 16 },
  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    marginHorizontal: Spacing.lg, marginBottom: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  addrEmoji: { fontSize: 18 },
  addrId: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: Colors.textPrimary },
  addrMeta: { ...Typography.caption, color: Colors.textSecondary },
  addrTime: { ...Typography.caption, color: Colors.textTertiary },
});
