import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

type Variant = 'red' | 'yellow' | 'green' | 'gray';

const STYLES: Record<Variant, { bg: string; fg: string }> = {
  red: { bg: Colors.pillRedBg, fg: Colors.gpsRed },
  yellow: { bg: Colors.pillYellowBg, fg: Colors.gpsYellow },
  green: { bg: Colors.pillGreenBg, fg: Colors.gpsGreen },
  gray: { bg: Colors.surface, fg: Colors.textSecondary },
};

export const Pill: React.FC<{ variant: Variant; label: string; testID?: string }> = ({
  variant,
  label,
  testID,
}) => {
  const s = STYLES[variant];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} testID={testID}>
      <Text style={[styles.text, { color: s.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
