import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export const ROLE_LABELS = { USER: 'Usuario', NUTRITIONIST: 'Nutricionista', ADMIN: 'Administrador' };
export const NUTRI_STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado' };

const TONES = {
  green: { bg: colors.primarySoft, fg: colors.primaryDark },
  gold: { bg: colors.accentSoft, fg: '#8A6212' },
  blue: { bg: colors.waterSoft, fg: '#0369A1' },
  purple: { bg: '#EDE9FE', fg: '#6D28D9' },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  gray: { bg: colors.bg, fg: colors.inkSoft },
};

/** Etiqueta chica de color. */
export function Tag({ label, tone = 'gray' }) {
  const t = TONES[tone] || TONES.gray;
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export const roleTone = (role) => ({ USER: 'blue', NUTRITIONIST: 'purple', ADMIN: 'gray' }[role] || 'gray');
export const statusTone = (status) => ({ PENDING: 'gold', APPROVED: 'green', REJECTED: 'red' }[status] || 'gray');

/** Chips horizontales para filtrar. */
export function FilterChips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.label}{o.count != null ? ` (${o.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Selector de una opción entre varias (rol, plan). */
export function Segmented({ options, value, onChange, disabled }) {
  return (
    <View style={[styles.segmented, disabled && { opacity: 0.5 }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={disabled || active}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: '800' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: '#fff' },
  segmented: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  segmentTextActive: { color: colors.primaryDark },
});
