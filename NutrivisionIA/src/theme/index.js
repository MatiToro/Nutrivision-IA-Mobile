// Sistema de diseño de NutriVision IA (mobile).
// Mismos colores que la versión Web para mantener la identidad de marca.
export const colors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  ink: '#17191C',
  inkSoft: '#62666D',
  inkMuted: '#9AA0A8',
  line: '#E4E6EA',

  primary: '#189B4E',
  primaryDark: '#0E7A3A',
  primaryLight: '#22B562',
  primarySoft: '#E4F5EA',

  accent: '#D9A02C',
  accentSoft: '#FBF0D9',
  danger: '#C0392B',
  dangerSoft: '#FBE9E7',

  water: '#0EA5E9',
  waterSoft: '#E0F2FE',

  // Identidad de color por macro (igual que en la Web)
  protein: '#3B82F6',
  carbs: '#EAB308',
  fats: '#E0554B',
  fiber: '#8B5CF6',
};

export const gradients = {
  primary: ['#22B562', '#0E7A3A'],
  premium: ['#F4C25B', '#D9A02C'],
};

export const radius = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const shadow = {
  card: {
    shadowColor: '#17191C',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  float: {
    shadowColor: '#0E7A3A',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};

export const type = {
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft },
  tiny: { fontSize: 11, color: colors.inkSoft },
};
