import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { shortDay } from '../utils/dates';

const HEIGHT = 120;

/**
 * Calorías por día (7 barras) con la meta diaria como línea de referencia.
 * `days`: [{ date, calories }]. Tocá una barra para ver el valor exacto.
 * Opcional: `selected` + `onSelect` para que la pantalla sepa qué día está elegido.
 */
export default function WeekBars({ days, goal, selected: selectedProp, onSelect }) {
  const [selectedLocal, setSelectedLocal] = useState(null);
  const selected = selectedProp ?? selectedLocal;
  const setSelected = onSelect ?? setSelectedLocal;
  const top = Math.max(goal || 0, ...days.map((d) => d.calories), 1) * 1.1;
  const goalY = goal ? HEIGHT - (goal / top) * HEIGHT : null;
  const active = selected ?? days.length - 1;

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.readout}>
        <Text style={styles.readoutStrong}>{Math.round(days[active]?.calories || 0)} kcal</Text>
        {'  '}el {days[active] ? `${days[active].date.getDate()}/${days[active].date.getMonth() + 1}` : ''}
        {goal ? `  ·  meta ${goal} kcal` : ''}
      </Text>
      <View style={styles.chart}>
        {goalY != null ? <View style={[styles.goalLine, { top: goalY }]} /> : null}
        {days.map((d, i) => {
          const h = d.calories ? Math.max((d.calories / top) * HEIGHT, 3) : 0;
          const over = goal && d.calories > goal * 1.1;
          return (
            <Pressable key={d.date.toISOString()} onPress={() => setSelected(i)} style={styles.col} accessibilityLabel={`${Math.round(d.calories)} kilocalorías`}>
              <View style={styles.barArea}>
                <View style={[
                  styles.bar,
                  { height: h, backgroundColor: over ? colors.accent : colors.primary },
                  i !== active && { opacity: 0.55 },
                ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {days.map((d, i) => (
          <Text key={d.date.toISOString()} style={[styles.label, i === active && styles.labelActive]}>
            {shortDay(d.date)}{'\n'}{d.date.getDate()}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontSize: 12, color: colors.inkSoft },
  readoutStrong: { fontSize: 14, fontWeight: '800', color: colors.ink },
  chart: { height: HEIGHT, flexDirection: 'row', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inkMuted },
  col: { flex: 1 },
  barArea: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, width: '100%' },
  labels: { flexDirection: 'row', gap: 8 },
  label: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.inkMuted, lineHeight: 14 },
  labelActive: { color: colors.ink, fontWeight: '800' },
});
