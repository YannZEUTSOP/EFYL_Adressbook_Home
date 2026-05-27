import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Button } from '../../src/components/Button';
import {
  HouseholdSurvey, emptySurvey, emptyPerson, emptyCommerce,
  IncomeLevel, Utility, Toilets, KitchenPosition, WallMaterial, RoofMaterial,
  Education, Gender,
} from '../../src/types/survey';

type StepKey =
  | 'intro' | 'totalPersons' | 'income' | 'incomeLevel'
  | 'phones' | 'internet' | 'electricity' | 'water'
  | 'toilets' | 'kitchen' | 'rooms' | 'floors'
  | 'walls' | 'windows' | 'roof'
  | 'vehicles' | 'isCommerce' | 'commerce'
  | 'personsIntro' | 'personEntry'
  | 'summary';

export default function SurveyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, saveSurvey, getLocalSurvey, deleteSurvey } = useApp();
  const addressId = decodeURIComponent(String(id || ''));

  const [survey, setSurvey] = useState<HouseholdSurvey>(emptySurvey(addressId));
  const [stepKey, setStepKey] = useState<StepKey>('intro');
  const [personIdx, setPersonIdx] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const existing = await getLocalSurvey(addressId);
      if (existing) setSurvey(existing);
    })();
  }, [addressId, getLocalSurvey]);

  const set = <K extends keyof HouseholdSurvey>(k: K, v: HouseholdSurvey[K]) => {
    setSurvey((s) => ({ ...s, [k]: v }));
    setErrorMsg('');
  };

  const setCommerce = (field: string, v: string) => {
    setSurvey((s) => ({
      ...s,
      commerce: { ...(s.commerce || emptyCommerce()), [field]: v },
    }));
  };

  const setPerson = (field: string, v: any) => {
    setSurvey((s) => {
      const persons = [...s.persons];
      while (persons.length <= personIdx) persons.push(emptyPerson());
      persons[personIdx] = { ...persons[personIdx], [field]: v };
      return { ...s, persons };
    });
  };

  // Order of steps (skip commerce if not is_commerce)
  const ORDER: StepKey[] = [
    'intro', 'totalPersons', 'income', 'incomeLevel',
    'phones', 'internet', 'electricity', 'water',
    'toilets', 'kitchen', 'rooms', 'floors',
    'walls', 'windows', 'roof', 'vehicles',
    'isCommerce', 'commerce', 'personsIntro', 'personEntry', 'summary',
  ];

  const idx = ORDER.indexOf(stepKey);
  const totalSteps = ORDER.length;

  const validate = (): boolean => {
    setErrorMsg('');
    if (stepKey === 'totalPersons') {
      if (!Number.isFinite(survey.total_persons) || survey.total_persons < 1) {
        setErrorMsg(t.survey.errPositive);
        return false;
      }
    }
    if (stepKey === 'income') {
      if (!survey.main_income_source.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'toilets' && survey.toilets === 'other' && !survey.toilets_other.trim()) {
      setErrorMsg(t.survey.errRequired); return false;
    }
    if (stepKey === 'walls' && survey.wall_materials === 'other' && !survey.wall_materials_other.trim()) {
      setErrorMsg(t.survey.errRequired); return false;
    }
    if (stepKey === 'roof' && survey.roof_materials === 'other' && !survey.roof_materials_other.trim()) {
      setErrorMsg(t.survey.errRequired); return false;
    }
    if (stepKey === 'commerce') {
      const c = survey.commerce || emptyCommerce();
      if (!c.name.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'personEntry') {
      const p = survey.persons[personIdx] || emptyPerson();
      if (!p.name.trim()) { setErrorMsg(t.survey.errRequired); return false; }
      if (!Number.isFinite(p.age) || p.age < 0 || p.age > 120) { setErrorMsg(t.survey.errMaxAge); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    let next = ORDER[idx + 1];
    // Skip commerce if not commerce
    if (next === 'commerce' && !survey.is_commerce) next = 'personsIntro';
    setStepKey(next);
  };

  const goBack = () => {
    let prev = ORDER[Math.max(0, idx - 1)];
    if (prev === 'commerce' && !survey.is_commerce) prev = 'isCommerce';
    setStepKey(prev);
  };

  const addAnotherPerson = () => {
    if (!validate()) return;
    setPersonIdx((i) => i + 1);
    // ensure the slot exists
    setSurvey((s) => {
      const persons = [...s.persons];
      while (persons.length <= personIdx + 1) persons.push(emptyPerson());
      return { ...s, persons, total_persons: Math.max(s.total_persons, persons.length) };
    });
  };

  const finishPersons = () => {
    if (!validate()) return;
    if (survey.persons.length === 0) {
      setErrorMsg(t.survey.p_atLeastOne);
      return;
    }
    setStepKey('summary');
  };

  const onSave = async () => {
    await saveSurvey(survey);
    Alert.alert(t.survey.saveSuccess, '');
    router.replace(`/address/${encodeURIComponent(addressId)}`);
  };

  // Render helpers
  const ChoiceRow = <T extends string>(
    options: { v: T; label: string }[],
    current: T,
    onChange: (v: T) => void,
    testIdPrefix?: string
  ) => (
    <View style={styles.choiceRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.v}
          style={[styles.choice, current === o.v && styles.choiceActive]}
          onPress={() => onChange(o.v)}
          testID={`${testIdPrefix || 'choice'}-${o.v}`}
        >
          <Text style={[styles.choiceTxt, current === o.v && styles.choiceTxtActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const YesNo = (val: boolean, onChange: (v: boolean) => void, testID?: string) => (
    <View style={styles.yesnoRow}>
      <TouchableOpacity
        style={[styles.yesno, val && styles.yesnoActive]}
        onPress={() => onChange(true)}
        testID={`${testID || 'yn'}-yes`}
      >
        <Text style={[styles.yesnoTxt, val && styles.yesnoTxtActive]}>{t.survey.yes}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.yesno, !val && styles.yesnoActive]}
        onPress={() => onChange(false)}
        testID={`${testID || 'yn'}-no`}
      >
        <Text style={[styles.yesnoTxt, !val && styles.yesnoTxtActive]}>{t.survey.no}</Text>
      </TouchableOpacity>
    </View>
  );

  const NumberField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    testID?: string
  ) => (
    <View style={styles.numberFieldRow}>
      <Text style={styles.numberFieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.numStep} onPress={() => onChange(Math.max(0, value - 1))} testID={`${testID}-dec`}>
        <Ionicons name="remove" size={16} color={Colors.primary} />
      </TouchableOpacity>
      <TextInput
        testID={testID}
        style={styles.numInput}
        value={String(value)}
        onChangeText={(s) => {
          const n = parseInt(s.replace(/\D/g, ''), 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="number-pad"
      />
      <TouchableOpacity style={styles.numStep} onPress={() => onChange(value + 1)} testID={`${testID}-inc`}>
        <Ionicons name="add" size={16} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const Q = (title: string) => <Text style={styles.qTitle}>{title}</Text>;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="survey-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="survey-back-btn">
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.survey.title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((idx + 1) / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{t.survey.progress} {idx + 1} / {totalSteps}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 140 }}>

          {stepKey === 'intro' && (
            <View testID="step-intro">
              <Text style={styles.intro}>{t.survey.intro}</Text>
              <Text style={styles.code}>{addressId}</Text>
            </View>
          )}

          {stepKey === 'totalPersons' && (
            <View testID="step-totalPersons">
              {Q(t.survey.q_total_persons)}
              {NumberField('', survey.total_persons, (n) => set('total_persons', n), 'total-persons')}
            </View>
          )}

          {stepKey === 'income' && (
            <View>
              {Q(t.survey.q_main_income)}
              <TextInput style={styles.text} value={survey.main_income_source}
                onChangeText={(v) => set('main_income_source', v)}
                placeholder="ex: Commerce, Agriculture..."
                placeholderTextColor={Colors.textTertiary} testID="main-income" />
              {Q(t.survey.q_other_income)}
              <TextInput style={styles.text} value={survey.other_income_sources}
                onChangeText={(v) => set('other_income_sources', v)}
                placeholderTextColor={Colors.textTertiary} testID="other-income" />
            </View>
          )}

          {stepKey === 'incomeLevel' && (
            <View>
              {Q(t.survey.q_income_level)}
              {ChoiceRow<IncomeLevel>(
                [
                  { v: 'very_low', label: t.survey.opt_very_low },
                  { v: 'low', label: t.survey.opt_low },
                  { v: 'medium', label: t.survey.opt_medium },
                  { v: 'high', label: t.survey.opt_high },
                ],
                survey.income_level, (v) => set('income_level', v), 'income-level'
              )}
            </View>
          )}

          {stepKey === 'phones' && (
            <View>
              {Q(t.survey.q_num_phones)}
              {NumberField('', survey.num_phones, (n) => set('num_phones', n), 'num-phones')}
            </View>
          )}

          {stepKey === 'internet' && (
            <View>
              {Q(t.survey.q_internet)}
              {YesNo(survey.has_internet, (v) => set('has_internet', v), 'internet')}
            </View>
          )}

          {stepKey === 'electricity' && (
            <View>
              {Q(t.survey.q_electricity)}
              {ChoiceRow<Utility>([
                { v: 'stable', label: t.survey.opt_stable },
                { v: 'unstable', label: t.survey.opt_unstable },
                { v: 'none', label: t.survey.opt_none },
              ], survey.electricity, (v) => set('electricity', v), 'electricity')}
            </View>
          )}

          {stepKey === 'water' && (
            <View>
              {Q(t.survey.q_water)}
              {ChoiceRow<Utility>([
                { v: 'stable', label: t.survey.opt_stable },
                { v: 'unstable', label: t.survey.opt_unstable },
                { v: 'none', label: t.survey.opt_none },
              ], survey.water, (v) => set('water', v), 'water')}
            </View>
          )}

          {stepKey === 'toilets' && (
            <View>
              {Q(t.survey.q_toilets)}
              {ChoiceRow<Toilets>([
                { v: 'flush', label: t.survey.opt_flush },
                { v: 'traditional', label: t.survey.opt_traditional },
                { v: 'other', label: t.survey.opt_other },
              ], survey.toilets, (v) => set('toilets', v), 'toilets')}
              {survey.toilets === 'other' && (
                <TextInput style={styles.text} value={survey.toilets_other}
                  onChangeText={(v) => set('toilets_other', v)}
                  placeholder={t.survey.q_toilets_other}
                  placeholderTextColor={Colors.textTertiary} testID="toilets-other" />
              )}
            </View>
          )}

          {stepKey === 'kitchen' && (
            <View>
              {Q(t.survey.q_kitchen)}
              {ChoiceRow<KitchenPosition>([
                { v: 'room', label: t.survey.opt_room },
                { v: 'living_room', label: t.survey.opt_living_room },
                { v: 'separate', label: t.survey.opt_separate },
              ], survey.kitchen_position, (v) => set('kitchen_position', v), 'kitchen')}
            </View>
          )}

          {stepKey === 'rooms' && (
            <View>
              {Q(t.survey.q_num_living_rooms)}
              {NumberField('', survey.num_living_rooms, (n) => set('num_living_rooms', n), 'num-rooms')}
            </View>
          )}

          {stepKey === 'floors' && (
            <View>
              {Q(t.survey.q_num_floors)}
              {NumberField('', survey.num_floors, (n) => set('num_floors', n), 'num-floors')}
            </View>
          )}

          {stepKey === 'walls' && (
            <View>
              {Q(t.survey.q_walls)}
              {ChoiceRow<WallMaterial>([
                { v: 'concrete', label: t.survey.opt_concrete },
                { v: 'adobe', label: t.survey.opt_adobe },
                { v: 'wood', label: t.survey.opt_wood },
                { v: 'other', label: t.survey.opt_other },
              ], survey.wall_materials, (v) => set('wall_materials', v), 'walls')}
              {survey.wall_materials === 'other' && (
                <TextInput style={styles.text} value={survey.wall_materials_other}
                  onChangeText={(v) => set('wall_materials_other', v)}
                  placeholder={t.survey.q_walls_other}
                  placeholderTextColor={Colors.textTertiary} testID="walls-other" />
              )}
            </View>
          )}

          {stepKey === 'windows' && (
            <View>
              {Q(t.survey.q_windows)}
              {YesNo(survey.has_glass_windows, (v) => set('has_glass_windows', v), 'windows')}
            </View>
          )}

          {stepKey === 'roof' && (
            <View>
              {Q(t.survey.q_roof)}
              {ChoiceRow<RoofMaterial>([
                { v: 'metal', label: t.survey.opt_metal },
                { v: 'wood', label: t.survey.opt_wood },
                { v: 'plastic', label: t.survey.opt_plastic },
                { v: 'concrete', label: t.survey.opt_concrete },
                { v: 'other', label: t.survey.opt_other },
              ], survey.roof_materials, (v) => set('roof_materials', v), 'roof')}
              {survey.roof_materials === 'other' && (
                <TextInput style={styles.text} value={survey.roof_materials_other}
                  onChangeText={(v) => set('roof_materials_other', v)}
                  placeholder={t.survey.q_roof_other}
                  placeholderTextColor={Colors.textTertiary} testID="roof-other" />
              )}
            </View>
          )}

          {stepKey === 'vehicles' && (
            <View>
              {Q(t.survey.q_vehicles)}
              {NumberField(t.survey.q_bicycles, survey.vehicles_bicycles, (n) => set('vehicles_bicycles', n), 'v-bicycles')}
              {NumberField(t.survey.q_motorcycles, survey.vehicles_motorcycles, (n) => set('vehicles_motorcycles', n), 'v-motorcycles')}
              {NumberField(t.survey.q_cars, survey.vehicles_cars, (n) => set('vehicles_cars', n), 'v-cars')}
              {NumberField(t.survey.q_trucks, survey.vehicles_trucks, (n) => set('vehicles_trucks', n), 'v-trucks')}
            </View>
          )}

          {stepKey === 'isCommerce' && (
            <View>
              {Q(t.survey.q_is_commerce)}
              {YesNo(survey.is_commerce, (v) => set('is_commerce', v), 'is-commerce')}
            </View>
          )}

          {stepKey === 'commerce' && (
            <View>
              {Q(t.survey.c_title)}
              <Label>{t.survey.c_name}</Label>
              <TextInput style={styles.text} value={survey.commerce?.name || ''}
                onChangeText={(v) => setCommerce('name', v)} testID="c-name" />
              <Label>{t.survey.c_owner}</Label>
              <TextInput style={styles.text} value={survey.commerce?.owner || ''}
                onChangeText={(v) => setCommerce('owner', v)} testID="c-owner" />
              <Label>{t.survey.c_phone}</Label>
              <TextInput style={styles.text} value={survey.commerce?.phone || ''}
                onChangeText={(v) => setCommerce('phone', v)} keyboardType="phone-pad" testID="c-phone" />
              <Label>{t.survey.c_products}</Label>
              <TextInput style={[styles.text, { height: 60 }]} multiline value={survey.commerce?.products || ''}
                onChangeText={(v) => setCommerce('products', v)} testID="c-products" />
              <Label>{t.survey.c_weekdays}</Label>
              <TextInput style={styles.text} value={survey.commerce?.hours_weekdays || ''}
                onChangeText={(v) => setCommerce('hours_weekdays', v)} testID="c-weekdays" />
              <Label>{t.survey.c_saturday}</Label>
              <TextInput style={styles.text} value={survey.commerce?.hours_saturday || ''}
                onChangeText={(v) => setCommerce('hours_saturday', v)} testID="c-saturday" />
              <Label>{t.survey.c_sunday}</Label>
              <TextInput style={styles.text} value={survey.commerce?.hours_sunday || ''}
                onChangeText={(v) => setCommerce('hours_sunday', v)} testID="c-sunday" />
            </View>
          )}

          {stepKey === 'personsIntro' && (
            <View>
              {Q(t.survey.p_intro)}
              <Text style={styles.code}>{addressId}</Text>
            </View>
          )}

          {stepKey === 'personEntry' && (() => {
            const p = survey.persons[personIdx] || emptyPerson();
            return (
              <View testID={`person-${personIdx}`}>
                <Text style={styles.qTitle}>{t.survey.p_title} #{personIdx + 1}</Text>
                <Label>{t.survey.p_name}</Label>
                <TextInput style={styles.text} value={p.name} onChangeText={(v) => setPerson('name', v)} testID="p-name" />
                <Label>{t.survey.p_age}</Label>
                <TextInput
                  testID="p-age" style={styles.text} value={String(p.age || 0)}
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    const n = parseInt(v.replace(/\D/g, ''), 10);
                    setPerson('age', Number.isFinite(n) ? n : 0);
                  }}
                />
                <Label>{t.survey.p_gender}</Label>
                {ChoiceRow<Gender>([
                  { v: 'male', label: t.survey.opt_male },
                  { v: 'female', label: t.survey.opt_female },
                ], p.gender, (v) => setPerson('gender', v), 'p-gender')}
                <Label>{t.survey.p_education}</Label>
                {ChoiceRow<Education>([
                  { v: 'primary', label: t.survey.opt_primary },
                  { v: 'middle', label: t.survey.opt_middle },
                  { v: 'high_school', label: t.survey.opt_high_school },
                  { v: 'university', label: t.survey.opt_university },
                  { v: 'none', label: t.survey.opt_no_school },
                ], p.education, (v) => setPerson('education', v), 'p-edu')}
                <Label>{t.survey.p_profession}</Label>
                <TextInput style={styles.text} value={p.profession} onChangeText={(v) => setPerson('profession', v)} testID="p-profession" />
                <Label>{t.survey.p_place}</Label>
                <TextInput style={styles.text} value={p.frequented_place} onChangeText={(v) => setPerson('frequented_place', v)} testID="p-place" />
              </View>
            );
          })()}

          {stepKey === 'summary' && (
            <View testID="step-summary">
              <Text style={styles.qTitle}>{t.survey.summaryTitle}</Text>
              <Card title={t.survey.summaryPersons}>
                {survey.persons.map((p, i) => (
                  <Text key={i} style={styles.summaryLine}>
                    {i + 1}. {p.name} • {p.age} • {t.survey[`opt_${p.gender}` as 'opt_male' | 'opt_female']} • {p.profession || '—'}
                  </Text>
                ))}
              </Card>
              <Card title={t.survey.summaryHouse}>
                <Text style={styles.summaryLine}>{t.survey.q_num_living_rooms}: {survey.num_living_rooms}</Text>
                <Text style={styles.summaryLine}>{t.survey.q_num_floors}: {survey.num_floors}</Text>
                <Text style={styles.summaryLine}>{t.survey.q_walls}: {survey.wall_materials}{survey.wall_materials === 'other' ? ` (${survey.wall_materials_other})` : ''}</Text>
                <Text style={styles.summaryLine}>{t.survey.q_roof}: {survey.roof_materials}{survey.roof_materials === 'other' ? ` (${survey.roof_materials_other})` : ''}</Text>
              </Card>
              <Card title={t.survey.summaryUtilities}>
                <Text style={styles.summaryLine}>⚡ {survey.electricity}  💧 {survey.water}  🌐 {survey.has_internet ? t.survey.yes : t.survey.no}</Text>
                <Text style={styles.summaryLine}>🚽 {survey.toilets}  🍳 {survey.kitchen_position}</Text>
              </Card>
              {survey.is_commerce && (
                <Card title={t.survey.summaryCommerce}>
                  <Text style={styles.summaryLine}>{survey.commerce?.name} — {survey.commerce?.owner}</Text>
                  <Text style={styles.summaryLine}>{survey.commerce?.products}</Text>
                </Card>
              )}
            </View>
          )}

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorTxt}>{errorMsg}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {stepKey !== 'intro' && (
          <Button label={t.survey.back} variant="secondary" style={{ flex: 1 }} onPress={goBack} />
        )}
        {stepKey === 'summary' ? (
          <Button label={t.survey.save} variant="accent" style={{ flex: 1 }} onPress={onSave} testID="save-survey-btn" />
        ) : stepKey === 'personEntry' ? (
          <>
            <Button label={t.survey.p_addAnother} variant="primary" style={{ flex: 1 }} onPress={addAnotherPerson} testID="add-person-btn" />
            <Button label={t.survey.p_done} variant="accent" style={{ flex: 1 }} onPress={finishPersons} testID="finish-persons-btn" />
          </>
        ) : (
          <Button label={stepKey === 'intro' ? t.survey.start : t.survey.next} variant="primary" style={{ flex: 1 }} onPress={goNext} testID="survey-next-btn" />
        )}
      </View>
    </SafeAreaView>
  );
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.fieldLabel}>{children}</Text>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  progressBar: { height: 6, backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  progressText: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  intro: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 24 },
  code: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: Colors.primary, marginBottom: Spacing.md, textAlign: 'center' },
  qTitle: { ...Typography.h2, fontSize: 20, marginBottom: Spacing.lg, lineHeight: 28 },
  text: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary, marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  choiceRow: { gap: 8, marginBottom: Spacing.md },
  choice: { paddingVertical: 14, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.divider },
  choiceActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceTxt: { ...Typography.body, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  choiceTxtActive: { color: Colors.white },
  yesnoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  yesno: { flex: 1, height: 60, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  yesnoActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yesnoTxt: { ...Typography.h3, fontFamily: 'DMSans_700Bold', color: Colors.textPrimary },
  yesnoTxtActive: { color: Colors.white },
  numberFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  numberFieldLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  numStep: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  numInput: { width: 60, height: 44, textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, color: Colors.primary, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.divider },
  errorBox: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#FEE2E2', padding: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.md },
  errorTxt: { ...Typography.bodySm, color: Colors.error, flex: 1 },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.divider },
  summaryCard: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm, ...Shadows.card },
  summaryTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  summaryLine: { ...Typography.body, color: Colors.textPrimary, marginVertical: 2 },
});
