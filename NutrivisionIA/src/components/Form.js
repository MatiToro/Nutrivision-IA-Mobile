import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../theme';

/** Campo numérico con etiqueta y unidad (kg, cm, años, kcal, g). */
export function NumberField({ label, value, onChangeText, unit, placeholder, decimal = false, style, editable = true, inputRef, ...props }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.numberWrap, !editable && { backgroundColor: colors.bg }]}>
        <TextInput
          ref={inputRef}
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          style={styles.numberInput}
          editable={editable}
          maxLength={6}
          {...props}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export function TextField({ label, style, ...props }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.inkMuted} style={[styles.numberWrap, styles.textInput]} {...props} />
    </View>
  );
}

/** Botones tipo "chip" para elegir una opción corta (ej. sexo). */
export function ChipGroup({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tarjeta seleccionable con ícono, título, descripción y radio. */
export function OptionCard({ option, active, onPress, compact = false }) {
  const { Icon, label, desc, subtitle } = option;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, compact && { paddingVertical: 11 }, active && styles.optionActive, pressed && { opacity: 0.85 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      {Icon ? (
        <View style={[styles.optionIcon, active && { backgroundColor: colors.primary }]}>
          <Icon size={20} color={active ? '#fff' : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{label}</Text>
        {desc || subtitle ? <Text style={styles.optionDesc}>{desc || subtitle}</Text> : null}
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  numberWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 14, backgroundColor: colors.surface,
  },
  numberInput: { flex: 1, minWidth: 0, width: '100%', paddingVertical: 12, fontSize: 17, fontWeight: '700', color: colors.ink },
  textInput: { paddingVertical: 12, fontSize: 15, color: colors.ink },
  unit: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', marginLeft: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: colors.primaryDark },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  optionDesc: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
});
