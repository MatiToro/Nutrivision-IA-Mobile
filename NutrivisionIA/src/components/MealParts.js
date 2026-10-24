import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Sparkles } from 'lucide-react-native';
import { colors, gradients, radius } from '../theme';

const ALIGNMENT = {
  ON_TRACK: { label: 'Va con tu objetivo', bg: colors.primarySoft, fg: colors.primaryDark },
  NEEDS_ADJUSTMENT: { label: 'Necesita ajustes', bg: colors.accentSoft, fg: '#8A6212' },
  OFF_TRACK: { label: 'Se aleja de tu objetivo', bg: colors.dangerSoft, fg: colors.danger },
};

/** Totales del plato: kcal + macros con sus colores. */
export function MacroTotals({ calories, proteinG, carbsG, fatG }) {
  const items = [
    { label: 'kcal', value: Math.round(calories || 0), color: colors.primary },
    { label: 'Prot', value: `${Math.round(proteinG || 0)}g`, color: colors.protein },
    { label: 'Carbs', value: `${Math.round(carbsG || 0)}g`, color: colors.carbs },
    { label: 'Grasas', value: `${Math.round(fatG || 0)}g`, color: colors.fats },
  ];
  return (
    <View style={styles.totals}>
      {items.map((it) => (
        <View key={it.label} style={styles.total}>
          <Text style={[styles.totalValue, { color: it.color }]} numberOfLines={1}>{it.value}</Text>
          <Text style={styles.totalLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Devolución del Coach IA, con el aviso de que no reemplaza a un profesional. */
export function CoachCard({ feedback, updating, note }) {
  if (!feedback) return null;
  const align = ALIGNMENT[feedback.alignment];
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.disclaimer}>
        <AlertTriangle size={13} color={colors.inkSoft} />
        <Text style={styles.disclaimerText}>
          El Coach IA da sugerencias generales, no reemplaza el consejo de un nutricionista u otro profesional de la salud.
        </Text>
      </View>
      <View style={[styles.coach, updating && { opacity: 0.55 }]}>
        <View style={styles.coachHead}>
          <LinearGradient colors={gradients.primary} style={styles.coachIcon}>
            <Sparkles size={18} color="#fff" />
          </LinearGradient>
          <Text style={styles.coachTitle}>Coach IA</Text>
          {align ? (
            <View style={[styles.pill, { backgroundColor: align.bg }]}>
              <Text style={[styles.pillText, { color: align.fg }]}>{align.label}</Text>
            </View>
          ) : null}
        </View>
        {updating ? <Text style={styles.note}>Actualizando la devolución según tus cambios…</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Text style={styles.summary}>{feedback.summary}</Text>
        {feedback.tips?.map((tip) => (
          <View key={tip} style={styles.tip}>
            <View style={styles.dot} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  totalLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', marginTop: 1 },
  disclaimer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 2 },
  disclaimerText: { flex: 1, fontSize: 11, color: colors.inkSoft, lineHeight: 16 },
  coach: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16, gap: 8 },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  coachIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800' },
  note: { fontSize: 12, color: colors.inkSoft, fontStyle: 'italic' },
  summary: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  tipText: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 19 },
});
