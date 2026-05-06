// EFYL Address Book — Design System
export const Colors = {
  primary: '#0D5C3A',
  primaryLight: '#1A8C58',
  accent: '#E8851A',
  accentLight: '#FDB44B',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  gpsRed: '#DC2626',
  gpsYellow: '#D97706',
  gpsGreen: '#16A34A',
  background: '#F8F6F0',
  card: '#FFFFFF',
  surface: '#F1EDE4',
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textTertiary: '#9A9A9A',
  divider: '#E2DDD5',
  border: '#D4CFC6',
  white: '#FFFFFF',
  pillRedBg: '#FEE2E2',
  pillYellowBg: '#FEF3C7',
  pillGreenBg: '#DCFCE7',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const Typography = {
  display: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  h1: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  h2: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    lineHeight: 30,
    color: Colors.textPrimary,
  },
  h3: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 18,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textPrimary,
  },
  bodySm: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: Colors.textPrimary,
  },
  caption: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textTertiary,
  },
  addressCode: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  addressCodeLg: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
};
