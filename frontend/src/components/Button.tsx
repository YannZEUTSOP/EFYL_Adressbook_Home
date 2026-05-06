import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

export const Button: React.FC<{
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}> = ({ label, onPress, variant = 'primary', disabled, loading, style, testID }) => {
  const v = VARIANTS[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 2 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: Colors.primary, fg: Colors.white },
  accent: { bg: Colors.accent, fg: Colors.white },
  secondary: { bg: 'transparent', fg: Colors.primary, border: Colors.primary },
  danger: { bg: Colors.error, fg: Colors.white },
  ghost: { bg: 'transparent', fg: Colors.textPrimary },
};

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
