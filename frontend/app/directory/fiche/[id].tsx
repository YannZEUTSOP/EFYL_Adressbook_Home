// Fiche d'adresse (public record) — shareable information + guidance to the door.
// Privacy: household records never expose resident data (see backend whitelist).
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Image, Linking, Platform, Modal, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../src/theme';
import { useApp } from '../../../src/contexts/AppContext';
import { Api } from '../../../src/services/api';
import type { DirectoryDetail } from '../../../src/services/api';
import { LeafletMap } from '../../../src/components/LeafletMap';

const CAT_META: Record<string, { icon: any; color: string; bg: string }> = {
  household: { icon: 'home', color: Colors.primary, bg: '#E7F3EC' },
  commerce: { icon: 'storefront', color: Colors.accent, bg: '#FDF0E0' },
  public: { icon: 'business', color: '#7C3AED', bg: '#EFE9FE' },
  heritage: { icon: 'sparkles', color: '#0E7490', bg: '#E0F2FE' },
};

function compassLabel(deg: number, fr: boolean): string {
  const dirs = fr
    ? ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest']
    : ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  return dirs[Math.round(deg / 45) % 8];
}

export default function DirectoryFiche() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language, isOnline } = useApp();
  const [rec, setRec] = useState<DirectoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRec(await Api.directoryEntry(decodeURIComponent(String(id))));
      } catch {
        setRec(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerTxt}>{t.common.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!rec) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center} testID="fiche-not-found">
          <Ionicons name="alert-circle-outline" size={44} color={Colors.textTertiary} />
          <Text style={styles.centerTitle}>{t.directory.notFound}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="fiche-back-empty">
            <Text style={styles.backBtnTxt}>← {t.survey.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = CAT_META[rec.category] || CAT_META.household;
  const val = (k?: string | null) => (k && (t.directory.val as any)[k]) || k || '';
  const hasCoords = rec.lat !== null && rec.lng !== null;
  const dest = `${rec.lat},${rec.lng}`;
  const navSourceLabel =
    rec.nav_source === 'nav_point' ? t.directory.navSourceNav
    : rec.nav_source === 'corrected' ? t.directory.navSourceCorrected
    : t.directory.navSourceGps;

  const openUrl = (url: string) => {
    setNavOpen(false);
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(() => {});
  };

  const rows: { label: string; value: string }[] = [];
  const d = rec.details || {};
  const push = (label: string, value: any) => {
    if (value === null || value === undefined || value === '' ) return;
    rows.push({ label, value: String(value) });
  };
  if (rec.category === 'commerce') {
    push(t.directory.fieldProducts, d.products);
    push(t.directory.fieldOwner, d.owner);
    push(t.directory.fieldPhone, d.phone);
    push(t.directory.fieldHoursWeek, d.hours_weekdays === 'closed' ? t.directory.closed : d.hours_weekdays);
    push(t.directory.fieldHoursSat, d.hours_saturday === 'closed' ? t.directory.closed : d.hours_saturday);
    push(t.directory.fieldHoursSun, d.hours_sunday === 'closed' ? t.directory.closed : d.hours_sunday);
  } else if (rec.category === 'public') {
    push(t.directory.fieldCategory, d.service_category === 'other' ? (d.service_category_other || val('other')) : val(d.service_category));
    push(t.directory.fieldManagingOrg, d.managing_org);
    push(t.directory.fieldPhone, d.phone);
    push(t.directory.fieldHours, d.hours === 'closed' ? t.directory.closed : d.hours);
    push(t.directory.fieldCapacity, d.capacity_max);
    push(t.directory.fieldUsage, d.usage_current);
    push(t.directory.fieldNotes, d.notes);
  } else if (rec.category === 'heritage') {
    push(t.directory.fieldKind, val(d.kind));
    push(t.directory.fieldCategory, d.site_category === 'other' ? (d.site_category_other || val('other')) : val(d.site_category));
    push(t.directory.fieldDescription, d.description);
    push(t.directory.fieldAccess, val(d.access));
    push(t.directory.fieldFee, d.entry_fee);
    push(t.directory.fieldHours, d.hours === 'closed' ? t.directory.closed : d.hours);
    push(t.directory.fieldBestPeriod, d.best_period);
    if (d.photos_allowed !== null && d.photos_allowed !== undefined) {
      push(t.directory.fieldPhotosAllowed, d.photos_allowed ? t.directory.yes : t.directory.no);
    }
    push(t.directory.fieldRestrictions, d.restrictions);
    push(t.directory.fieldFacilities, d.facilities);
    push(t.directory.fieldRoad, val(d.road_access));
    push(t.directory.fieldManager, d.manager);
    push(t.directory.fieldPhone, d.phone);
  }

  const phone = d.phone || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="fiche-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="fiche-back-btn" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <Text style={[styles.catBadgeTxt, { color: meta.color }]}>
            {(t.directory as any)[
              `cat${rec.category.charAt(0).toUpperCase()}${rec.category.slice(1)}`
            ]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            Share.share({
              message: `${rec.name} — ${rec.address_id}${rec.matricule ? ` (${rec.matricule})` : ''}\n${rec.district}${rec.sector ? ` • ${rec.sector}` : ''}\nhttps://www.google.com/maps/dir/?api=1&destination=${dest}`,
            }).catch(() => {})
          }
          testID="fiche-share-btn"
          style={{ padding: 4 }}
        >
          <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, paddingBottom: 140 }}>
        <Text style={styles.name} testID="fiche-name">{rec.name}</Text>
        <Text style={styles.code} testID="fiche-code">{rec.address_id}</Text>
        <View style={styles.pillsRow}>
          {rec.matricule ? (
            <View style={styles.matPill} testID="fiche-matricule">
              <Ionicons name="pricetag" size={11} color={Colors.textPrimary} />
              <Text style={styles.matTxt}>{rec.matricule}</Text>
            </View>
          ) : (
            <Text style={styles.noMat}>{t.directory.noMatricule}</Text>
          )}
          {rec.verified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={11} color={Colors.white} />
              <Text style={styles.verifiedTxt}>{t.directory.verified}</Text>
            </View>
          )}
        </View>

        {!!rec.photo_base64 && (
          <Image
            source={{ uri: `data:image/jpeg;base64,${rec.photo_base64}` }}
            style={styles.photo}
            testID="fiche-photo"
          />
        )}

        {/* Location */}
        <Text style={styles.sectionTitle}>{t.directory.sectionLocation}</Text>
        <View style={styles.card}>
          <InfoRow label={t.newAddress.district} value={rec.district} />
          {!!rec.sector && <InfoRow label={t.newAddress.sector} value={rec.sector} />}
          {!!rec.street_id && <InfoRow label={t.newAddress.street} value={rec.street_id} />}
          {!!rec.house_number && <InfoRow label={t.newAddress.house} value={rec.house_number} />}
          {!!rec.access_hint && <InfoRow label={t.directory.accessHint} value={rec.access_hint} />}
          {!!rec.nav_note && <InfoRow label={t.directory.navTitle} value={rec.nav_note} />}
          {rec.azimuth_degrees !== null && rec.azimuth_degrees !== undefined && (
            <InfoRow
              label={t.directory.entrance}
              value={`${Math.round(rec.azimuth_degrees)}° ${compassLabel(rec.azimuth_degrees, language === 'fr')}`}
            />
          )}
          <View style={styles.navSourceRow}>
            <Ionicons
              name={rec.nav_source === 'nav_point' ? 'locate' : 'navigate-circle-outline'}
              size={14}
              color={rec.nav_source === 'nav_point' ? Colors.success : Colors.textSecondary}
            />
            <Text style={styles.navSourceTxt}>{navSourceLabel}</Text>
          </View>
        </View>

        {hasCoords && (
          <View style={styles.miniMap}>
            <LeafletMap
              centerLat={rec.lat as number}
              centerLng={rec.lng as number}
              zoom={17}
              offlineMode={!isOnline}
              pins={[{ id: rec.address_id, lat: rec.lat as number, lng: rec.lng as number, color: meta.color }]}
              style={{ height: '100%' }}
            />
          </View>
        )}

        {/* Category information */}
        {rows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.directory.sectionInfo}</Text>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <InfoRow key={i} label={r.label} value={r.value} />
              ))}
            </View>
          </>
        )}

        {rec.category === 'household' && (
          <View style={styles.privacyCard} testID="fiche-privacy">
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.privacyTxt}>{t.directory.privacyNote}</Text>
          </View>
        )}

        {!!phone && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`).catch(() => {})}
            testID="fiche-call-btn"
          >
            <Ionicons name="call" size={18} color={Colors.primary} />
            <Text style={styles.callTxt}>{t.directory.callBtn} {phone}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {hasCoords && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.navCta}
            activeOpacity={0.9}
            onPress={() => setNavOpen(true)}
            testID="fiche-nav-cta"
          >
            <Ionicons name="navigate" size={20} color={Colors.white} />
            <Text style={styles.navCtaTxt}>{t.directory.navTitle}</Text>
            <Ionicons name="chevron-up" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={navOpen} transparent animationType="slide" onRequestClose={() => setNavOpen(false)}>
        <TouchableOpacity style={styles.sheetBg} activeOpacity={1} onPress={() => setNavOpen(false)}>
          <View style={styles.sheet} testID="fiche-nav-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t.directory.navTitle}</Text>
            <Text style={styles.sheetHint}>{navSourceLabel} • {rec.lat?.toFixed(6)}, {rec.lng?.toFixed(6)}</Text>
            <SheetBtn
              icon="logo-google"
              label={t.directory.navGoogle}
              onPress={() => openUrl(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`)}
              testID="nav-google-btn"
            />
            <SheetBtn
              icon="earth"
              label={t.directory.navOsm}
              onPress={() => openUrl(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${rec.lat}%2C${rec.lng}`)}
              testID="nav-osm-btn"
            />
            <SheetBtn
              icon={copied ? 'checkmark-circle' : 'copy-outline'}
              label={copied ? t.directory.navCopied : t.directory.navCopy}
              onPress={async () => {
                await Clipboard.setStringAsync(dest);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              testID="nav-copy-btn"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const SheetBtn: React.FC<{ icon: any; label: string; onPress: () => void; testID?: string }> = ({
  icon, label, onPress, testID,
}) => (
  <TouchableOpacity style={styles.sheetBtn} onPress={onPress} activeOpacity={0.85} testID={testID}>
    <Ionicons name={icon} size={20} color={Colors.primary} />
    <Text style={styles.sheetBtnTxt}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
  },
  catBadgeTxt: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  name: { ...Typography.h1, fontSize: 26 },
  code: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 16, color: Colors.primary, letterSpacing: 1.2, marginTop: 2 },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap' },
  matPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  matTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: Colors.textPrimary },
  noMat: { ...Typography.caption, color: Colors.textTertiary, fontStyle: 'italic' },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  verifiedTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 10 },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg, marginTop: Spacing.md, resizeMode: 'cover' },
  sectionTitle: {
    ...Typography.label, color: Colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: Spacing.lg, marginBottom: Spacing.sm, fontSize: 12,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.divider, ...Shadows.card,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 6 },
  infoLabel: { ...Typography.bodySm, color: Colors.textSecondary, flex: 1 },
  infoValue: { ...Typography.label, color: Colors.textPrimary, flex: 1.4, textAlign: 'right' },
  navSourceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  navSourceTxt: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  miniMap: { height: 190, marginTop: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.card },
  privacyCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E7F3EC', borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.lg,
  },
  privacyTxt: { ...Typography.caption, color: Colors.primary, flex: 1, lineHeight: 17 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 13, marginTop: Spacing.md,
  },
  callTxt: { color: Colors.primary, fontFamily: 'DMSans_700Bold', fontSize: 15 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  navCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.lg, height: 56, ...Shadows.fab,
  },
  navCtaTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 16 },
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2, backgroundColor: Colors.divider, alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: { ...Typography.h3, textAlign: 'center' },
  sheetHint: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  sheetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
  },
  sheetBtnTxt: { ...Typography.label, flex: 1, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.lg },
  centerTitle: { ...Typography.h3 },
  centerTxt: { ...Typography.bodySm, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: 12, marginTop: Spacing.sm,
  },
  backBtnTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 14 },
});
