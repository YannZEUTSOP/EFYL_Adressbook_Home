// Multi-select products picker with custom additions.
// Stored as comma-separated string (canonical French labels for predefined items).
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';
import type { Strings, Lang } from '../i18n';

// canonical FR label -> EN display label
const PRODUCTS: { fr: string; en: string }[] = [
  { fr: 'Alimentation générale', en: 'General groceries' },
  { fr: 'Boissons', en: 'Drinks' },
  { fr: 'Pain & pâtisserie', en: 'Bread & pastry' },
  { fr: 'Fruits & légumes', en: 'Fruits & vegetables' },
  { fr: 'Viande & poisson', en: 'Meat & fish' },
  { fr: 'Restauration / plats cuisinés', en: 'Food / cooked meals' },
  { fr: 'Produits ménagers', en: 'Household products' },
  { fr: 'Cosmétiques & beauté', en: 'Cosmetics & beauty' },
  { fr: 'Coiffure', en: 'Hairdressing' },
  { fr: 'Vêtements & chaussures', en: 'Clothing & shoes' },
  { fr: 'Tissus & couture', en: 'Fabrics & tailoring' },
  { fr: 'Téléphones & accessoires', en: 'Phones & accessories' },
  { fr: 'Crédit téléphonique & Mobile Money', en: 'Airtime & Mobile Money' },
  { fr: 'Électronique', en: 'Electronics' },
  { fr: 'Pièces détachées', en: 'Spare parts' },
  { fr: 'Quincaillerie', en: 'Hardware' },
  { fr: 'Matériaux de construction', en: 'Building materials' },
  { fr: 'Gaz domestique', en: 'Cooking gas' },
  { fr: 'Médicaments / pharmacie', en: 'Medicines / pharmacy' },
  { fr: 'Papeterie & scolaire', en: 'Stationery & school' },
  { fr: 'Meubles', en: 'Furniture' },
];

export function parseProducts(value: string): string[] {
  return (value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

type Props = {
  value: string;                 // comma-separated
  onChange: (v: string) => void;
  t: Strings;
  language: Lang;
};

export const ProductsPicker: React.FC<Props> = ({ value, onChange, t, language }) => {
  const selected = parseProducts(value);
  const [custom, setCustom] = useState('');
  const predefined = new Set(PRODUCTS.map((p) => p.fr));

  const toggle = (fr: string) => {
    const next = selected.includes(fr) ? selected.filter((s) => s !== fr) : [...selected, fr];
    onChange(next.join(', '));
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v].join(', '));
    setCustom('');
  };

  const customSelected = selected.filter((s) => !predefined.has(s));

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{t.survey.prod_hint}</Text>
      <View style={styles.chips}>
        {PRODUCTS.map((p) => {
          const active = selected.includes(p.fr);
          return (
            <TouchableOpacity
              key={p.fr}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(p.fr)}
              testID={`prod-${p.fr}`}
            >
              {active && <Ionicons name="checkmark" size={12} color={Colors.white} />}
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {language === 'fr' ? p.fr : p.en}
              </Text>
            </TouchableOpacity>
          );
        })}
        {customSelected.map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, styles.chipCustom]} onPress={() => toggle(s)} testID={`prod-custom-${s}`}>
            <Ionicons name="close" size={12} color={Colors.white} />
            <Text style={[styles.chipTxt, styles.chipTxtActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={custom}
          onChangeText={setCustom}
          placeholder={t.survey.prod_addPlaceholder}
          placeholderTextColor={Colors.textTertiary}
          onSubmitEditing={addCustom}
          testID="prod-custom-input"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addCustom} testID="prod-custom-add">
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={styles.addTxt}>{t.survey.prod_add}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  hint: { ...Typography.bodySm, color: Colors.textSecondary, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipCustom: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { ...Typography.caption, fontFamily: 'DMSans_500Medium', color: Colors.textPrimary },
  chipTxtActive: { color: Colors.white },
  addRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  input: {
    flex: 1, backgroundColor: Colors.card, borderColor: Colors.divider, borderWidth: 1,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textPrimary,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 14, justifyContent: 'center',
  },
  addTxt: { color: Colors.white, fontFamily: 'DMSans_700Bold', fontSize: 13 },
});
