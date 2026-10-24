import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Droplet, Minus, Plus } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { WATER_GLASS_ML, WATER_GOAL_GLASSES } from '../context/AppContext';

/** Anillo de calorías consumidas vs. meta diaria. */
export function CalorieRing({ consumed = 0, goal, size = 140, stroke = 13, light = true }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal ? Math.min(consumed / goal, 1) : 0;
  const track = light ? 'rgba(255,255,255,0.25)' : colors.primarySoft;
  const fill = light ? '#fff' : colors.primary;
  const fg = light ? '#fff' : colors.ink;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={fill} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color: fg }]} maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit>{Math.round(consumed)}</Text>
        <Text style={[styles.ringUnit, { color: fg }]} maxFontSizeMultiplier={1.15}>kcal</Text>
        <Text style={[styles.ringGoal, { color: fg }]} maxFontSizeMultiplier={1.15} numberOfLines={1}>{goal ? `de ${goal}` : 'meta sin definir'}</Text>
      </View>
    </View>
  );
}

/** Barra de progreso de un macronutriente. */
export function MacroBar({ label, value = 0, goal, color, light = false }) {
  const pct = goal ? Math.min(value / goal, 1) : 0;
  const fg = light ? '#fff' : colors.ink;
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.macroTop}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.macroLabel, { color: fg }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.macroValue, { color: fg }]} numberOfLines={1}>
          {Math.round(value)} g<Text style={styles.macroGoal}> / {goal ? `${Math.round(goal)} g` : '—'}</Text>
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: light ? 'rgba(255,255,255,0.25)' : colors.bg }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Control interactivo de vasos de agua. */
export function WaterTracker({ glasses, onChange }) {
  const liters = (glasses * WATER_GLASS_ML) / 1000;
  const goalL = (WATER_GOAL_GLASSES * WATER_GLASS_ML) / 1000;
  return (
    <View style={styles.water}>
      <View style={styles.waterHeader}>
        <View style={styles.waterIcon}><Droplet size={18} color={colors.water} fill={colors.waterSoft} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.waterTitle}>Agua de hoy</Text>
          <Text style={styles.waterSub}>
            {String(liters).replace('.', ',')} L de {goalL} L
          </Text>
        </View>
        <View style={styles.waterCtrls}>
          <Pressable
            onPress={() => onChange(-1)}
            disabled={glasses === 0}
            accessibilityLabel="Quitar un vaso de agua"
            style={({ pressed }) => [styles.waterBtn, styles.waterBtnGhost, glasses === 0 && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Minus size={18} color={colors.water} />
          </Pressable>
          <Text style={styles.waterCount}>{glasses}</Text>
          <Pressable
            onPress={() => onChange(1)}
            accessibilityLabel="Agregar un vaso de agua"
            style={({ pressed }) => [styles.waterBtn, pressed && { opacity: 0.7 }]}
          >
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
      <View style={styles.glasses}>
        {Array.from({ length: WATER_GOAL_GLASSES }).map((_, i) => (
          <View key={i} style={[styles.glass, i < glasses && styles.glassFull]} />
        ))}
      </View>
      <Text style={glasses >= WATER_GOAL_GLASSES ? styles.waterDone : styles.waterHint}>
        {glasses >= WATER_GOAL_GLASSES ? '¡Meta de agua cumplida!' : `Cada vaso equivale a ${WATER_GLASS_ML} ml`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  ringValue: { fontSize: 30, fontWeight: '800', includeFontPadding: false, textAlignVertical: 'center', maxWidth: '80%' },
  ringUnit: { fontSize: 12, opacity: 0.85, fontWeight: '600', includeFontPadding: false },
  ringGoal: { fontSize: 11, opacity: 0.75, marginTop: 2, includeFontPadding: false, maxWidth: '80%', textAlign: 'center' },
  macroTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  macroValue: { fontSize: 13, fontWeight: '800' },
  macroGoal: { fontWeight: '500', opacity: 0.7 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  water: { gap: 12 },
  waterHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waterIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.waterSoft, alignItems: 'center', justifyContent: 'center' },
  waterTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  waterSub: { fontSize: 12, color: colors.inkSoft },
  waterCtrls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waterBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.water, alignItems: 'center', justifyContent: 'center' },
  waterBtnGhost: { backgroundColor: colors.waterSoft },
  waterCount: { fontSize: 18, fontWeight: '800', color: colors.ink, minWidth: 20, textAlign: 'center' },
  glasses: { flexDirection: 'row', gap: 6 },
  glass: { flex: 1, height: 26, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.waterSoft },
  glassFull: { backgroundColor: colors.water, borderColor: colors.water },
  waterHint: { fontSize: 11, color: colors.inkMuted },
  waterDone: { fontSize: 12, fontWeight: '700', color: colors.water },
});
