// Local data export (CSV / JSON) built from the device's own storage.
// Guarantees ALL addresses appear in the export — even those not yet synced to the server.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Storage } from '../services/storage';
import type { AddressDTO } from '../services/api';
import type { HouseholdSurvey } from '../types/survey';

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(addresses: AddressDTO[], surveys: Record<string, HouseholdSurvey>): string {
  const headers = [
    'address_id', 'district', 'sector', 'street_id', 'house_number',
    'contact_name', 'contact_phone', 'notes',
    'latitude', 'longitude', 'accuracy_meters', 'low_accuracy',
    'verified', 'flag_count',
    'azimuth_degrees', 'lat_raw', 'lng_raw', 'lat_corrected', 'lng_corrected',
    'has_photo', 'photos_count', 'created_at',
    'owner_id', 'owner_name',
    'survey_type', 'family_name',
    'survey_total_persons', 'survey_main_income', 'survey_other_income',
    'survey_income_level', 'survey_num_phones', 'survey_has_internet',
    'survey_electricity', 'survey_water', 'survey_toilets', 'survey_toilets_other',
    'survey_kitchen_position', 'survey_num_living_rooms', 'survey_num_floors',
    'survey_wall_materials', 'survey_wall_other',
    'survey_has_glass_windows',
    'survey_roof_materials', 'survey_roof_other',
    'survey_vehicles_bicycles', 'survey_vehicles_motorcycles',
    'survey_vehicles_cars', 'survey_vehicles_trucks',
    'survey_is_commerce',
    'commerce_name', 'commerce_owner', 'commerce_phone', 'commerce_products',
    'commerce_hours_weekdays', 'commerce_hours_saturday', 'commerce_hours_sunday',
    'public_name', 'public_category', 'public_category_other',
    'public_managing_org', 'public_phone', 'public_notes',
    'heritage_name', 'heritage_kind', 'heritage_category', 'heritage_access',
    'persons_count', 'persons_summary',
  ];
  const lines = [headers.join(',')];
  for (const a of addresses) {
    const s = surveys[a.address_id] || null;
    const c = s?.commerce || null;
    const p = s?.public_service || null;
    const h = s?.heritage || null;
    const persons = s?.persons || [];
    const personsSummary = persons
      .map((pe) => `${pe.name || '?'}(${pe.age ?? '?'}|${pe.gender || '?'}|${pe.education || '?'}|${pe.profession || ''})`)
      .join('; ');
    const row = [
      a.address_id, a.district, a.sector, a.street_id, a.house_number,
      a.contact_name || '', a.contact_phone || '', a.notes || '',
      a.latitude, a.longitude, a.accuracy_meters, a.low_accuracy || false,
      a.verified, a.flag_count,
      a.azimuth_degrees ?? '', a.lat_raw ?? '', a.lng_raw ?? '',
      a.lat_corrected ?? '', a.lng_corrected ?? '',
      (a.photos_count ?? (a.photos || []).length) > 0 || !!a.photo_base64,
      a.photos_count ?? (a.photos || []).length, a.created_at,
      a.owner_id || '', a.owner_name || '',
      s?.survey_type || '', s?.family_name || '',
      s?.total_persons ?? '', s?.main_income_source || '', s?.other_income_sources || '',
      s?.income_level || '', s?.num_phones ?? '', s?.has_internet ?? '',
      s?.electricity || '', s?.water || '', s?.toilets || '', s?.toilets_other || '',
      s?.kitchen_position || '', s?.num_living_rooms ?? '', s?.num_floors ?? '',
      s?.wall_materials || '', s?.wall_materials_other || '',
      s?.has_glass_windows ?? '',
      s?.roof_materials || '', s?.roof_materials_other || '',
      s?.vehicles_bicycles ?? '', s?.vehicles_motorcycles ?? '',
      s?.vehicles_cars ?? '', s?.vehicles_trucks ?? '',
      s?.is_commerce ?? '',
      c?.name || '', c?.owner || '', c?.phone || '', c?.products || '',
      c?.hours_weekdays || '', c?.hours_saturday || '', c?.hours_sunday || '',
      p?.name || '', p?.category || '', p?.category_other || '',
      p?.managing_org || '', p?.phone || '', p?.notes || '',
      h?.name || '', h?.kind || '', h?.category || '', h?.access || '',
      persons.length, personsSummary,
    ];
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n');
}

export async function exportLocalData(kind: 'csv' | 'json'): Promise<void> {
  const [addresses, surveys] = await Promise.all([Storage.getAddresses(), Storage.getSurveys()]);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `efyl_export_${stamp}.${kind}`;
  const content = kind === 'csv'
    ? buildCsv(addresses, surveys)
    : JSON.stringify({
        exported_at: new Date().toISOString(),
        count: addresses.length,
        items: addresses.map((a) => ({ ...a, survey: surveys[a.address_id] || null })),
      }, null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: kind === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: kind === 'csv' ? 'text/csv' : 'application/json',
      dialogTitle: filename,
    });
  }
}
