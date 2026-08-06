// Structured opening-hours field: Open/Closed toggle + valid time pickers.
// Stored format: "HH:MM-HH:MM" | "closed" | "" (not set). Invalid times are impossible.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import type { Strings } from '../i18n';

export function isValidHours(v: string): boolean {
  if (v === 'closed') return true;
  const m = v.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return false;
  const open = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const close = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  return close > open;
}

export function formatHours(v: string, t: Strings): string {
  if (v === 'closed') return t.survey.h_closed;
  if (!v) return t.survey.h_notSet;
  return v.replace('-', ' – ');
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

type Props = {
  label: string;
  value: string;                // "HH:MM-HH:MM" | "closed" | ""
  onChange: (v: string) => void;
  t: Strings;
  testID?: string;
};

export const HoursField: React.FC<Props> = ({ label, value, onChange, t, testID }) => {
  const [picker, setPicker] = useState<'open' | 'close' | null>(null);
  const isClosed = value === 'closed';
  const m = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  const openTime = m ? m[1] : '';
  const closeTime = m ? m[2] : '';
  const invalid = !!m && !isValidHours(value);

  const setTime = (which: 'open' | 'close', hh: string, mm: string) => {
    const tstr = `${hh}:${mm}`;
    const o = which === 'open' ? tstr : (openTime || '08:00');
    const c = which === 'close' ? tstr : (closeTime || '18:00');
    onChange(`${o}-${c}`);
    setPicker(null);
  };

  const [selHour, setSelHour] = useState('08');

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.stateChip, !isClosed && !!m && styles.stateChipActive]}
          onPress={() => { if (isClosed || !m) onChange('08:00-18:00'); }}
          testID={`${testID}-open`}
        >
          <Text style={[styles.stateTxt, !isClosed && !!m && styles.stateTxtActive]}>{t.survey.h_open}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.stateChip, isClosed && styles.stateChipClosed]}
          onPress={() => onChange('closed')}
          testID={`${testID}-closed`}
        >
          <Text style={[styles.stateTxt, isClosed && styles.stateTxtActive]}>{t.survey.h_closed}</Text>
        </TouchableOpacity>

        {!isClosed && !!m && (
          <>
            <TouchableOpacity style={styles.timeBtn} onPress={() => { setSelHour(openTime.slice(0, 2)); setPicker('open'); }} testID={`${testID}-from`}>
              <Text style={styles.timeTxt}>{openTime}</Text>
            </TouchableOpacity>
            <Text style={styles.dash}>–</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => { setSelHour(closeTime.slice(0, 2)); setPicker('close'); }} testID={`${testID}-to`}>
              <Text style={styles.timeTxt}>{closeTime}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      {invalid && <Text style={styles.err}>{t.survey.h_invalid}</Text>}

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {picker === 'open' ? t.survey.h_from : t.survey.h_to} — {t.survey.h_pick}
            </Text>
            <View style={styles.pickerRow}>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.cell, selHour === h && styles.cellActive]}
                    onPress={() => setSelHour(h)}
                    testID={`hour-${h}`}
                  >
                    <Text style={[styles.cellTxt, selHour === h && styles.cellTxtActive]}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.colMin}>
                {MINUTES.map((mm) => (
                  <TouchableOpacity
                    key={mm}
                    style={styles.cellMin}
                    onPress={() => picker && setTime(picker, selHour, mm)}
                    testID={`minute-${mm}`}
                  >
                    <Text style={styles.cellMinTxt}>{selHour}:{mm}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPicker(null)}>
              <Text style={styles.cancelTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stateChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  stateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stateChipClosed: { backgroundColor: Colors.textSecondary, borderColor: Colors.textSecondary },
  stateTxt: { ...Typography.bodySm, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  stateTxtActive: { color: Colors.white },
  timeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  timeTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 15, color: Colors.primary },
  dash: { ...Typography.body, color: Colors.textSecondary },
  err: { ...Typography.caption, color: Colors.error, marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, width: '100%', maxWidth: 340, maxHeight: 440 },
  modalTitle: { ...Typography.label, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', gap: 10, height: 300 },
  col: { flex: 1 },
  colMin: { flex: 1, justifyContent: 'center', gap: 8 },
  cell: { paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center', marginBottom: 2, backgroundColor: Colors.surface },
  cellActive: { backgroundColor: Colors.primary },
  cellTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, color: Colors.textPrimary },
  cellTxtActive: { color: Colors.white },
  cellMin: { paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', backgroundColor: '#E8F3ED', borderWidth: 1, borderColor: Colors.primary },
  cellMinTxt: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 16, color: Colors.primary },
  cancelBtn: { alignSelf: 'center', marginTop: Spacing.sm, padding: 8 },
  cancelTxt: { fontSize: 18, color: Colors.textSecondary },
});
