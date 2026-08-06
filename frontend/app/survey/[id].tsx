import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../src/theme';
import { useApp } from '../../src/contexts/AppContext';
import { Button } from '../../src/components/Button';
import {
  HouseholdSurvey, emptySurvey, emptyPerson, emptyCommerce, emptyPublicService,
  IncomeLevel, Utility, Toilets, KitchenPosition, WallMaterial, RoofMaterial,
  Education, Gender, SurveyType, PublicCategory, Person,
} from '../../src/types/survey';
import { HoursField, isValidHours, formatHours } from '../../src/components/HoursField';
import { ProductsPicker, parseProducts } from '../../src/components/ProductsPicker';

type StepKey =
  | 'typeChoice' | 'intro' | 'totalPersons' | 'income' | 'incomeLevel'
  | 'phones' | 'internet' | 'electricity' | 'water'
  | 'toilets' | 'kitchen' | 'rooms' | 'floors'
  | 'walls' | 'windows' | 'roof'
  | 'vehicles' | 'commerce' | 'publicService'
  | 'personsIntro' | 'personEntry'
  | 'summary';

const HOUSEHOLD_ORDER: StepKey[] = [
  'typeChoice', 'intro', 'totalPersons', 'income', 'incomeLevel',
  'phones', 'internet', 'electricity', 'water',
  'toilets', 'kitchen', 'rooms', 'floors',
  'walls', 'windows', 'roof', 'vehicles',
  'personsIntro', 'personEntry', 'summary',
];

const COMMERCE_ORDER: StepKey[] = [
  'typeChoice', 'commerce', 'summary',
];

const PUBLIC_ORDER: StepKey[] = [
  'typeChoice', 'publicService', 'summary',
];

export default function SurveyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language, saveSurvey, getLocalSurvey } = useApp();
  const addressId = decodeURIComponent(String(id || ''));

  const [survey, setSurvey] = useState<HouseholdSurvey>(emptySurvey(addressId));
  const [stepKey, setStepKey] = useState<StepKey>('typeChoice');
  const [typeChosen, setTypeChosen] = useState(false);
  const [personMode, setPersonMode] = useState<'list' | 'form'>('list');
  const [personDraft, setPersonDraft] = useState<Person>(emptyPerson());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const existing = await getLocalSurvey(addressId);
      if (existing) {
        setSurvey(existing);
        setTypeChosen(true);
        // If resuming, skip type choice & jump to the right step
        setStepKey(
          existing.survey_type === 'commerce' ? 'commerce'
          : existing.survey_type === 'public' ? 'publicService'
          : 'intro'
        );
      }
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
    setErrorMsg('');
  };

  const setPublic = (field: string, v: string) => {
    setSurvey((s) => ({
      ...s,
      public_service: { ...(s.public_service || emptyPublicService()), [field]: v },
    }));
    setErrorMsg('');
  };

  const setDraftField = (field: keyof Person, v: any) => {
    setPersonDraft((p) => ({ ...p, [field]: v }));
    setErrorMsg('');
  };

  const ORDER: StepKey[] =
    survey.survey_type === 'commerce' ? COMMERCE_ORDER
    : survey.survey_type === 'public' ? PUBLIC_ORDER
    : HOUSEHOLD_ORDER;
  const idx = Math.max(0, ORDER.indexOf(stepKey));
  const totalSteps = ORDER.length;

  const chooseType = (type: SurveyType) => {
    setSurvey((s) => ({
      ...s,
      survey_type: type,
      is_commerce: type === 'commerce',
      is_public: type === 'public',
      commerce: type === 'commerce' ? (s.commerce || emptyCommerce()) : null,
      public_service: type === 'public' ? (s.public_service || emptyPublicService()) : null,
    }));
    setTypeChosen(true);
    // Move to next step in the chosen order
    const order = type === 'commerce' ? COMMERCE_ORDER : type === 'public' ? PUBLIC_ORDER : HOUSEHOLD_ORDER;
    setStepKey(order[1]);
    setErrorMsg('');
  };

  const validate = (): boolean => {
    setErrorMsg('');
    if (stepKey === 'typeChoice') return true;
    if (stepKey === 'totalPersons') {
      if (!Number.isFinite(survey.total_persons) || survey.total_persons < 1) {
        setErrorMsg(t.survey.errPositive);
        return false;
      }
    }
    if (stepKey === 'income') {
      if (!survey.main_income_source.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'incomeLevel' && !survey.income_level) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'internet' && survey.has_internet === null) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'electricity' && !survey.electricity) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'water' && !survey.water) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'toilets') {
      if (!survey.toilets) { setErrorMsg(t.survey.errChoice); return false; }
      if (survey.toilets === 'other' && !survey.toilets_other.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'kitchen' && !survey.kitchen_position) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'rooms' && (!Number.isFinite(survey.num_living_rooms) || survey.num_living_rooms < 1)) {
      setErrorMsg(t.survey.errPositive); return false;
    }
    if (stepKey === 'floors' && (!Number.isFinite(survey.num_floors) || survey.num_floors < 1)) {
      setErrorMsg(t.survey.errPositive); return false;
    }
    if (stepKey === 'walls') {
      if (!survey.wall_materials) { setErrorMsg(t.survey.errChoice); return false; }
      if (survey.wall_materials === 'other' && !survey.wall_materials_other.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'windows' && survey.has_glass_windows === null) { setErrorMsg(t.survey.errChoice); return false; }
    if (stepKey === 'roof') {
      if (!survey.roof_materials) { setErrorMsg(t.survey.errChoice); return false; }
      if (survey.roof_materials === 'other' && !survey.roof_materials_other.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    if (stepKey === 'commerce') {
      const c = survey.commerce || emptyCommerce();
      if (!c.name.trim()) { setErrorMsg(t.survey.errRequired); return false; }
      if (parseProducts(c.products).length === 0) { setErrorMsg(t.survey.errProducts); return false; }
      for (const h of [c.hours_weekdays, c.hours_saturday, c.hours_sunday]) {
        if (h && !isValidHours(h)) { setErrorMsg(t.survey.h_invalid); return false; }
      }
    }
    if (stepKey === 'publicService') {
      const p = survey.public_service || emptyPublicService();
      if (!p.name.trim()) { setErrorMsg(t.survey.errRequired); return false; }
      if (!p.category) { setErrorMsg(t.survey.errChoice); return false; }
      if (p.category === 'other' && !p.category_other.trim()) { setErrorMsg(t.survey.errRequired); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    setStepKey(ORDER[Math.min(ORDER.length - 1, idx + 1)]);
  };

  const goBack = () => {
    setStepKey(ORDER[Math.max(0, idx - 1)]);
  };

  // ===== Persons management (add / edit / delete inside the wizard) =====
  const startAddPerson = () => {
    setPersonDraft(emptyPerson());
    setEditingIdx(null);
    setPersonMode('form');
    setErrorMsg('');
  };

  const startEditPerson = (i: number) => {
    setPersonDraft({ ...survey.persons[i] });
    setEditingIdx(i);
    setPersonMode('form');
    setErrorMsg('');
  };

  const confirmDeletePerson = (i: number) => {
    const doIt = () => {
      setSurvey((s) => ({ ...s, persons: s.persons.filter((_, j) => j !== i) }));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t.survey.pl_deleteConfirm)) doIt();
    } else {
      Alert.alert(t.survey.pl_deleteConfirm, '', [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.survey.pl_delete, style: 'destructive', onPress: doIt },
      ]);
    }
  };

  const savePersonDraft = () => {
    if (!personDraft.name.trim()) { setErrorMsg(t.survey.errRequired); return; }
    if (!Number.isFinite(personDraft.age) || personDraft.age < 0 || personDraft.age > 120) {
      setErrorMsg(t.survey.errMaxAge); return;
    }
    if (!personDraft.gender || !personDraft.education) { setErrorMsg(t.survey.errChoice); return; }
    setSurvey((s) => {
      const persons = [...s.persons];
      if (editingIdx !== null) persons[editingIdx] = personDraft;
      else persons.push(personDraft);
      return { ...s, persons, total_persons: Math.max(s.total_persons, persons.length) };
    });
    setPersonMode('list');
    setEditingIdx(null);
    setErrorMsg('');
  };

  const finishPersons = () => {
    if (survey.persons.length === 0) {
      setErrorMsg(t.survey.p_atLeastOne);
      return;
    }
    setStepKey('summary');
  };

  const onSave = async () => {
    const final = survey.survey_type === 'household'
      ? { ...survey, total_persons: Math.max(survey.total_persons, survey.persons.length) }
      : survey;
    await saveSurvey(final);
    Alert.alert(t.survey.saveSuccess, '');
    router.replace(`/address/${encodeURIComponent(addressId)}`);
  };

  const ChoiceRow = <T extends string>(
    options: { v: T; label: string; desc?: string }[],
    current: T | '',
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
          {!!o.desc && (
            <Text style={[styles.choiceDesc, current === o.v && styles.choiceDescActive]}>{o.desc}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const YesNo = (val: boolean | null, onChange: (v: boolean) => void, testID?: string) => (
    <View style={styles.yesnoRow}>
      <TouchableOpacity
        style={[styles.yesno, val === true && styles.yesnoActive]}
        onPress={() => onChange(true)}
        testID={`${testID || 'yn'}-yes`}
      >
        <Text style={[styles.yesnoTxt, val === true && styles.yesnoTxtActive]}>{t.survey.yes}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.yesno, val === false && styles.yesnoActive]}
        onPress={() => onChange(false)}
        testID={`${testID || 'yn'}-no`}
      >
        <Text style={[styles.yesnoTxt, val === false && styles.yesnoTxtActive]}>{t.survey.no}</Text>
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

          {stepKey === 'typeChoice' && (
            <View testID="step-typeChoice">
              <Text style={styles.qTitle}>{t.survey.typeChoiceTitle}</Text>
              <Text style={styles.intro}>{t.survey.typeChoiceHint}</Text>
              <TouchableOpacity
                style={[styles.typeCard, typeChosen && survey.survey_type === 'household' && styles.typeCardActive]}
                onPress={() => chooseType('household')}
                testID="type-choice-household"
              >
                <Text style={styles.typeTitle}>{t.survey.typeHousehold}</Text>
                <Text style={styles.typeDesc}>{t.survey.typeHouseholdDesc}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeCard, typeChosen && survey.survey_type === 'commerce' && styles.typeCardActive]}
                onPress={() => chooseType('commerce')}
                testID="type-choice-commerce"
              >
                <Text style={styles.typeTitle}>{t.survey.typeCommerce}</Text>
                <Text style={styles.typeDesc}>{t.survey.typeCommerceDesc}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeCard, typeChosen && survey.survey_type === 'public' && styles.typeCardActive]}
                onPress={() => chooseType('public')}
                testID="type-choice-public"
              >
                <Text style={styles.typeTitle}>{t.survey.typePublic}</Text>
                <Text style={styles.typeDesc}>{t.survey.typePublicDesc}</Text>
              </TouchableOpacity>
              <Text style={styles.code}>{addressId}</Text>
            </View>
          )}

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
                  { v: 'very_low', label: t.survey.opt_very_low, desc: t.survey.desc_very_low },
                  { v: 'low', label: t.survey.opt_low, desc: t.survey.desc_low },
                  { v: 'medium', label: t.survey.opt_medium, desc: t.survey.desc_medium },
                  { v: 'high', label: t.survey.opt_high, desc: t.survey.desc_high },
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
              <Text style={styles.intro}>{t.survey.q_num_rooms_hint}</Text>
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

          {stepKey === 'commerce' && (
            <View testID="step-commerce">
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
              <ProductsPicker
                value={survey.commerce?.products || ''}
                onChange={(v) => setCommerce('products', v)}
                t={t}
                language={language}
              />
              <HoursField
                label={t.survey.c_weekdays}
                value={survey.commerce?.hours_weekdays || ''}
                onChange={(v) => setCommerce('hours_weekdays', v)}
                t={t}
                testID="c-weekdays"
              />
              <HoursField
                label={t.survey.c_saturday}
                value={survey.commerce?.hours_saturday || ''}
                onChange={(v) => setCommerce('hours_saturday', v)}
                t={t}
                testID="c-saturday"
              />
              <HoursField
                label={t.survey.c_sunday}
                value={survey.commerce?.hours_sunday || ''}
                onChange={(v) => setCommerce('hours_sunday', v)}
                t={t}
                testID="c-sunday"
              />
            </View>
          )}

          {stepKey === 'publicService' && (
            <View testID="step-public">
              {Q(t.survey.pub_title)}
              <Label>{t.survey.pub_name}</Label>
              <TextInput style={styles.text} value={survey.public_service?.name || ''}
                onChangeText={(v) => setPublic('name', v)}
                placeholder={t.survey.pub_namePh}
                placeholderTextColor={Colors.textTertiary} testID="pub-name" />
              <Label>{t.survey.pub_category}</Label>
              {ChoiceRow<PublicCategory>([
                { v: 'school', label: `🏫 ${t.survey.cat_school}` },
                { v: 'health', label: `🏥 ${t.survey.cat_health}` },
                { v: 'government', label: `🏛️ ${t.survey.cat_government}` },
                { v: 'community', label: `🏟️ ${t.survey.cat_community}` },
                { v: 'water_point', label: `⛲ ${t.survey.cat_water_point}` },
                { v: 'antenna', label: `📡 ${t.survey.cat_antenna}` },
                { v: 'religious', label: `⛪ ${t.survey.cat_religious}` },
                { v: 'other', label: t.survey.opt_other },
              ], survey.public_service?.category || '', (v) => setPublic('category', v), 'pub-cat')}
              {survey.public_service?.category === 'other' && (
                <TextInput style={styles.text} value={survey.public_service?.category_other || ''}
                  onChangeText={(v) => setPublic('category_other', v)}
                  placeholder={t.survey.pub_category_other}
                  placeholderTextColor={Colors.textTertiary} testID="pub-cat-other-input" />
              )}
              <Label>{t.survey.pub_org}</Label>
              <TextInput style={styles.text} value={survey.public_service?.managing_org || ''}
                onChangeText={(v) => setPublic('managing_org', v)} testID="pub-org" />
              <Label>{t.survey.pub_phone}</Label>
              <TextInput style={styles.text} value={survey.public_service?.phone || ''}
                onChangeText={(v) => setPublic('phone', v)} keyboardType="phone-pad" testID="pub-phone" />
              <Label>{t.survey.pub_notes}</Label>
              <TextInput style={[styles.text, { height: 60 }]} multiline value={survey.public_service?.notes || ''}
                onChangeText={(v) => setPublic('notes', v)} testID="pub-notes" />
            </View>
          )}

          {stepKey === 'personsIntro' && (
            <View>
              {Q(t.survey.p_intro)}
              <Text style={styles.code}>{addressId}</Text>
            </View>
          )}

          {stepKey === 'personEntry' && personMode === 'list' && (
            <View testID="persons-list">
              <Text style={styles.qTitle}>{t.survey.pl_listTitle} ({survey.persons.length})</Text>
              {survey.persons.length === 0 && (
                <Text style={styles.intro}>{t.survey.pl_none}</Text>
              )}
              {survey.persons.map((p, i) => (
                <View key={i} style={styles.personCard} testID={`person-card-${i}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{i + 1}. {p.name}</Text>
                    <Text style={styles.personMeta}>
                      {p.age} {t.survey.pl_years} • {p.gender === 'male' ? t.survey.opt_male : p.gender === 'female' ? t.survey.opt_female : '—'} • {p.profession || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.personBtn} onPress={() => startEditPerson(i)} testID={`person-edit-${i}`}>
                    <Ionicons name="pencil" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.personBtn} onPress={() => confirmDeletePerson(i)} testID={`person-delete-${i}`}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <Button
                label={`+ ${t.survey.pl_add}`}
                variant="secondary"
                onPress={startAddPerson}
                testID="add-person-btn"
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          )}

          {stepKey === 'personEntry' && personMode === 'form' && (
            <View testID="person-form">
              <Text style={styles.qTitle}>
                {editingIdx !== null ? `${t.survey.pl_edit} — ${t.survey.p_title} #${editingIdx + 1}` : t.survey.pl_add}
              </Text>
              <Label>{t.survey.p_name}</Label>
              <TextInput style={styles.text} value={personDraft.name} onChangeText={(v) => setDraftField('name', v)} testID="p-name" />
              <Label>{t.survey.p_phone_or_email}</Label>
              <TextInput style={styles.text} value={personDraft.phone_or_email}
                onChangeText={(v) => setDraftField('phone_or_email', v)} testID="p-phone-email" />
              <Label>{t.survey.p_age}</Label>
              <TextInput
                testID="p-age" style={styles.text} value={String(personDraft.age || 0)}
                keyboardType="number-pad"
                onChangeText={(v) => {
                  const n = parseInt(v.replace(/\D/g, ''), 10);
                  setDraftField('age', Number.isFinite(n) ? n : 0);
                }}
              />
              <Label>{t.survey.p_gender}</Label>
              {ChoiceRow<Gender>([
                { v: 'male', label: t.survey.opt_male },
                { v: 'female', label: t.survey.opt_female },
              ], personDraft.gender, (v) => setDraftField('gender', v), 'p-gender')}
              <Label>{t.survey.p_education}</Label>
              {ChoiceRow<Education>([
                { v: 'primary', label: t.survey.opt_primary },
                { v: 'middle', label: t.survey.opt_middle },
                { v: 'high_school', label: t.survey.opt_high_school },
                { v: 'university', label: t.survey.opt_university },
                { v: 'none', label: t.survey.opt_no_school },
              ], personDraft.education, (v) => setDraftField('education', v), 'p-edu')}
              <Label>{t.survey.p_profession}</Label>
              <TextInput style={styles.text} value={personDraft.profession} onChangeText={(v) => setDraftField('profession', v)} testID="p-profession" />
              <Label>{t.survey.p_place}</Label>
              <TextInput style={styles.text} value={personDraft.frequented_place} onChangeText={(v) => setDraftField('frequented_place', v)} testID="p-place" />
            </View>
          )}

          {stepKey === 'summary' && (
            <View testID="step-summary">
              <Text style={styles.qTitle}>{t.survey.summaryTitle}</Text>
              <View style={[styles.tagBanner,
                survey.survey_type === 'commerce' ? styles.tagCommerce
                : survey.survey_type === 'public' ? styles.tagPublic
                : styles.tagHousehold]}>
                <Ionicons
                  name={survey.survey_type === 'commerce' ? 'storefront' : survey.survey_type === 'public' ? 'business' : 'home'}
                  size={14} color={Colors.white}
                />
                <Text style={styles.tagBannerTxt}>
                  {survey.survey_type === 'commerce' ? t.survey.typeCommerce
                    : survey.survey_type === 'public' ? t.survey.typePublic
                    : t.survey.typeHousehold}
                </Text>
              </View>
              {survey.survey_type === 'household' && (
                <>
                  <Card title={t.survey.summaryPersons}>
                    {survey.persons.map((p, i) => (
                      <Text key={i} style={styles.summaryLine}>
                        {i + 1}. {p.name} • {p.age} • {p.gender === 'male' ? t.survey.opt_male : p.gender === 'female' ? t.survey.opt_female : '—'} • {p.profession || '—'}
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
                </>
              )}
              {survey.survey_type === 'commerce' && (
                <Card title={t.survey.summaryCommerce}>
                  <Text style={styles.summaryLine}>{survey.commerce?.name} — {survey.commerce?.owner}</Text>
                  <Text style={styles.summaryLine}>{survey.commerce?.products}</Text>
                  <Text style={styles.summaryLine}>📞 {survey.commerce?.phone || '—'}</Text>
                  <Text style={styles.summaryLine}>🕐 {t.survey.c_weekdays}: {formatHours(survey.commerce?.hours_weekdays || '', t)}</Text>
                  <Text style={styles.summaryLine}>🕐 {t.survey.c_saturday}: {formatHours(survey.commerce?.hours_saturday || '', t)}</Text>
                  <Text style={styles.summaryLine}>🕐 {t.survey.c_sunday}: {formatHours(survey.commerce?.hours_sunday || '', t)}</Text>
                </Card>
              )}
              {survey.survey_type === 'public' && (
                <Card title={t.survey.summaryPublic}>
                  <Text style={styles.summaryLine}>{survey.public_service?.name}</Text>
                  <Text style={styles.summaryLine}>
                    {survey.public_service?.category === 'other'
                      ? survey.public_service?.category_other
                      : survey.public_service?.category
                        ? t.survey[`cat_${survey.public_service.category}` as keyof typeof t.survey] as string
                        : '—'}
                  </Text>
                  {!!survey.public_service?.managing_org && <Text style={styles.summaryLine}>🏢 {survey.public_service.managing_org}</Text>}
                  {!!survey.public_service?.phone && <Text style={styles.summaryLine}>📞 {survey.public_service.phone}</Text>}
                  {!!survey.public_service?.notes && <Text style={styles.summaryLine}>📝 {survey.public_service.notes}</Text>}
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
        {stepKey !== 'typeChoice' && stepKey !== 'intro' && !(stepKey === 'personEntry' && personMode === 'form') && (
          <Button label={t.survey.back} variant="secondary" style={{ flex: 1 }} onPress={goBack} />
        )}
        {stepKey === 'typeChoice' ? (
          // No bottom button on typeChoice — the cards are the action
          <View style={{ flex: 1, height: 48 }} />
        ) : stepKey === 'summary' ? (
          <Button label={t.survey.save} variant="accent" style={{ flex: 1 }} onPress={onSave} testID="save-survey-btn" />
        ) : stepKey === 'personEntry' ? (
          personMode === 'form' ? (
            <>
              <Button label={t.common.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => { setPersonMode('list'); setErrorMsg(''); }} testID="person-cancel-btn" />
              <Button label={t.survey.pl_save} variant="primary" style={{ flex: 1 }} onPress={savePersonDraft} testID="person-save-btn" />
            </>
          ) : (
            <Button label={t.survey.p_done} variant="accent" style={{ flex: 1 }} onPress={finishPersons} testID="finish-persons-btn" />
          )
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
  qTitle: { ...Typography.h2, fontSize: 20, marginBottom: Spacing.md, lineHeight: 28 },
  text: { backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 50, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary, marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  choiceRow: { gap: 8, marginBottom: Spacing.md },
  choice: { paddingVertical: 14, paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.divider },
  choiceActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceTxt: { ...Typography.body, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  choiceTxtActive: { color: Colors.white },
  choiceDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
  choiceDescActive: { color: 'rgba(255,255,255,0.85)' },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: 8, ...Shadows.card,
  },
  personName: { ...Typography.label, color: Colors.textPrimary },
  personMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  personBtn: { padding: 8 },
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
  typeCard: { backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.md, borderWidth: 2, borderColor: Colors.divider, ...Shadows.card },
  typeCardActive: { borderColor: Colors.primary, backgroundColor: '#F0F9F4' },
  typeTitle: { ...Typography.h2, fontSize: 20, marginBottom: 6 },
  typeDesc: { ...Typography.body, color: Colors.textSecondary },
  tagBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, marginBottom: Spacing.sm },
  tagHousehold: { backgroundColor: Colors.primary },
  tagCommerce: { backgroundColor: Colors.accent },
  tagPublic: { backgroundColor: '#8B5CF6' },
  tagBannerTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 12 },
});
