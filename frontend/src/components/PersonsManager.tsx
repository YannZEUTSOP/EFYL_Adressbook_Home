import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../theme';
import { useApp } from '../contexts/AppContext';
import type { Person, Gender, Education } from '../types/survey';
import { emptyPerson } from '../types/survey';

type Props = {
  addressId: string;
};

const GENDER_OPTS: { v: Gender; labelFr: string; labelEn: string }[] = [
  { v: 'male', labelFr: 'Homme', labelEn: 'Male' },
  { v: 'female', labelFr: 'Femme', labelEn: 'Female' },
];

const EDU_OPTS: { v: Education; labelFr: string; labelEn: string }[] = [
  { v: 'primary', labelFr: 'Primaire', labelEn: 'Primary' },
  { v: 'middle', labelFr: 'Collège', labelEn: 'Middle school' },
  { v: 'high_school', labelFr: 'Lycée', labelEn: 'High school' },
  { v: 'university', labelFr: 'Université', labelEn: 'University' },
  { v: 'none', labelFr: 'Aucune', labelEn: 'None' },
];

export const PersonsManager: React.FC<Props> = ({ addressId }) => {
  const { t, language, getLocalSurvey, addPerson, updatePerson, removePerson } = useApp();
  const [persons, setPersons] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Person>(emptyPerson());
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const s = await getLocalSurvey(addressId);
    setPersons(s?.persons || []);
    setLoaded(true);
  }, [addressId, getLocalSurvey]);

  useEffect(() => { reload(); }, [reload]);

  const onOpenAdd = () => {
    setDraft(emptyPerson());
    setEditorIndex(null);
    setError('');
    setEditorVisible(true);
  };

  const onOpenEdit = (index: number) => {
    setDraft({ ...persons[index] });
    setEditorIndex(index);
    setError('');
    setEditorVisible(true);
  };

  const onSave = async () => {
    setError('');
    if (!draft.name.trim()) { setError(t.persons.nameRequired); return; }
    if (!Number.isFinite(draft.age) || draft.age < 0 || draft.age > 120) {
      setError(t.persons.ageInvalid); return;
    }
    if (!draft.gender || !draft.education) { setError(t.survey.errChoice); return; }
    try {
      if (editorIndex === null) {
        await addPerson(addressId, draft);
      } else {
        await updatePerson(addressId, editorIndex, draft);
      }
      setEditorVisible(false);
      await reload();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const onAskRemove = (index: number) => {
    if (persons.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert(t.persons.atLeastOne);
      } else {
        Alert.alert('', t.persons.atLeastOne);
      }
      return;
    }
    const doRemove = async () => {
      try {
        await removePerson(addressId, index);
        await reload();
      } catch (e: any) {
        if (Platform.OS === 'web') {
          window.alert(String(e?.message || e));
        } else {
          Alert.alert('', String(e?.message || e));
        }
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${t.persons.removeConfirmTitle}\n\n${t.persons.removeConfirmBody}`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        t.persons.removeConfirmTitle,
        t.persons.removeConfirmBody,
        [
          { text: t.persons.cancel, style: 'cancel' },
          { text: t.persons.remove, style: 'destructive', onPress: doRemove },
        ]
      );
    }
  };

  if (!loaded) return null;

  return (
    <View style={styles.section} testID="persons-manager">
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>👨‍👩‍👧 {t.persons.sectionTitle}</Text>
          <Text style={styles.sectionCount}>
            {persons.length} {t.persons.countLabel}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onOpenAdd}
          activeOpacity={0.85}
          testID="add-person-btn"
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={styles.addBtnTxt}>{t.persons.add}</Text>
        </TouchableOpacity>
      </View>

      {persons.length === 0 ? (
        <Text style={styles.empty}>{t.persons.empty}</Text>
      ) : (
        persons.map((p, i) => (
          <View key={`${p.name}-${i}`} style={styles.personRow} testID={`person-row-${i}`}>
            <View style={styles.personAvatar}>
              <Text style={styles.personAvatarTxt}>
                {p.name.trim() ? p.name.trim()[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName} numberOfLines={1}>{p.name || '—'}</Text>
              <Text style={styles.personMeta} numberOfLines={1}>
                {p.age} {language === 'fr' ? 'ans' : 'y/o'} • {p.profession || '—'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => onOpenEdit(i)}
              testID={`edit-person-${i}`}
            >
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.iconBtnDanger]}
              onPress={() => onAskRemove(i)}
              testID={`remove-person-${i}`}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Editor modal */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editorIndex === null ? t.persons.addTitle : t.persons.editTitle}
              </Text>
              <TouchableOpacity onPress={() => setEditorVisible(false)} testID="editor-close">
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
              <Label>{t.persons.fieldName} *</Label>
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(v) => setDraft({ ...draft, name: v })}
                placeholderTextColor={Colors.textTertiary}
                testID="editor-name"
              />

              <Label>{t.persons.fieldPhone}</Label>
              <TextInput
                style={styles.input}
                value={draft.phone_or_email}
                onChangeText={(v) => setDraft({ ...draft, phone_or_email: v })}
                placeholderTextColor={Colors.textTertiary}
                testID="editor-phone"
              />

              <Label>{t.persons.fieldAge} *</Label>
              <TextInput
                style={styles.input}
                value={String(draft.age || 0)}
                keyboardType="number-pad"
                onChangeText={(v) => {
                  const n = parseInt(v.replace(/\D/g, ''), 10);
                  setDraft({ ...draft, age: Number.isFinite(n) ? n : 0 });
                }}
                testID="editor-age"
              />

              <Label>{t.persons.fieldGender}</Label>
              <View style={styles.choiceRow}>
                {GENDER_OPTS.map((o) => (
                  <TouchableOpacity
                    key={o.v}
                    style={[styles.choice, draft.gender === o.v && styles.choiceActive]}
                    onPress={() => setDraft({ ...draft, gender: o.v })}
                    testID={`editor-gender-${o.v}`}
                  >
                    <Text style={[styles.choiceTxt, draft.gender === o.v && styles.choiceTxtActive]}>
                      {language === 'fr' ? o.labelFr : o.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Label>{t.persons.fieldEducation}</Label>
              <View style={styles.choiceRow}>
                {EDU_OPTS.map((o) => (
                  <TouchableOpacity
                    key={o.v}
                    style={[styles.choice, draft.education === o.v && styles.choiceActive]}
                    onPress={() => setDraft({ ...draft, education: o.v })}
                    testID={`editor-edu-${o.v}`}
                  >
                    <Text style={[styles.choiceTxt, draft.education === o.v && styles.choiceTxtActive]}>
                      {language === 'fr' ? o.labelFr : o.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Label>{t.persons.fieldProfession}</Label>
              <TextInput
                style={styles.input}
                value={draft.profession}
                onChangeText={(v) => setDraft({ ...draft, profession: v })}
                placeholderTextColor={Colors.textTertiary}
                testID="editor-profession"
              />

              <Label>{t.persons.fieldPlace}</Label>
              <TextInput
                style={styles.input}
                value={draft.frequented_place}
                onChangeText={(v) => setDraft({ ...draft, frequented_place: v })}
                placeholderTextColor={Colors.textTertiary}
                testID="editor-place"
              />

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorTxt}>{error}</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnGhost]}
                onPress={() => setEditorVisible(false)}
                testID="editor-cancel"
              >
                <Text style={styles.footerBtnGhostTxt}>{t.persons.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnPrimary]}
                onPress={onSave}
                testID="editor-save"
              >
                <Text style={styles.footerBtnPrimaryTxt}>{t.persons.save}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.fieldLabel}>{children}</Text>
);

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h3, fontSize: 16, color: Colors.textPrimary },
  sectionCount: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  addBtnTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  empty: { ...Typography.body, color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.md },
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  personAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  personAvatarTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 16 },
  personName: { ...Typography.body, fontFamily: 'DMSans_700Bold', color: Colors.textPrimary },
  personMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnDanger: { backgroundColor: '#FEE2E2' },
  // Modal
  modalBackdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  modalTitle: { ...Typography.h2 },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginTop: Spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: Colors.card,
    borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 48,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.divider,
  },
  choiceActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceTxt: { ...Typography.bodySm, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  choiceTxtActive: { color: Colors.white },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', padding: Spacing.md,
    borderRadius: Radius.md, marginTop: Spacing.md,
  },
  errorTxt: { ...Typography.bodySm, color: Colors.error, flex: 1 },
  modalFooter: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  footerBtn: { flex: 1, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  footerBtnGhost: { backgroundColor: Colors.surface },
  footerBtnGhostTxt: { ...Typography.body, fontFamily: 'DMSans_700Bold', color: Colors.textPrimary },
  footerBtnPrimary: { backgroundColor: Colors.primary },
  footerBtnPrimaryTxt: { ...Typography.body, fontFamily: 'DMSans_700Bold', color: Colors.white },
});
