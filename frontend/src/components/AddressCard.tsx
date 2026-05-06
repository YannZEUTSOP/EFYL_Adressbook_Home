import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing, Typography } from '../theme';
import { Pill } from './Pill';
import type { AddressDTO } from '../services/api';

function accuracyVariant(a: number): 'red' | 'yellow' | 'green' {
  if (a <= 1.0) return 'green';
  if (a <= 3.0) return 'yellow';
  return 'red';
}

export const AddressCard: React.FC<{
  addr: AddressDTO;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
}> = ({ addr, onPress, onLongPress, testID }) => {
  const v = accuracyVariant(addr.accuracy_meters);
  const status = addr.flag_count >= 3 ? 'flagged' : addr.verified ? 'verified' : 'unverified';
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {addr.contact_name || addr.district}
          </Text>
          <Text style={styles.code} numberOfLines={1}>
            {addr.address_id}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {addr.district}{addr.notes ? ` • ${addr.notes}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          <Pill variant={v} label={`${addr.accuracy_meters.toFixed(1)}m`} />
          <View style={{ height: 6 }} />
          <Pill
            variant={status === 'verified' ? 'green' : status === 'flagged' ? 'red' : 'yellow'}
            label={status === 'verified' ? '✓' : status === 'flagged' ? '⚠' : '•'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 4,
    ...Shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  name: {
    ...Typography.h3,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  code: {
    ...Typography.addressCode,
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    ...Typography.caption,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
});
