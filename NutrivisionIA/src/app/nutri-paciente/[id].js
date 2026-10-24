import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Crown, History, Pencil, Target, UserMinus, Utensils } from 'lucide-react-native';
import { Badge, Card, EmptyState, PrimaryButton, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar, BackHeader } from '../../components/Nutritionist';
import { CalorieRing, MacroBar } from '../../components/Nutrition';
import WeekBars from '../../components/WeekBars';
import WeightChart from '../../components/WeightChart';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { addDays, longDate, sameDay, startOfDay } from '../../utils/dates';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS, findOption } from '../../constants/profile';
import { colors, radius } from '../../theme';

const pad = (n) => String(n).padStart(2, '0');
const FIELD_LABELS = {
  goal: 'Objetivo',
  dailyCalorieGoal: 'Calorías',
  dailyProteinGoalG: 'Proteínas',
  dailyCarbsGoalG: 'Carbohidratos',
  dailyFatGoalG: 'Grasas',
};
const fmtValue = (field, v) => {
  if (v == null) return '—';
  if (field === 'goal') return findOption(GOAL_OPTIONS, v)?.label ?? v;
  return field === 'dailyCalorieGoal' ? `${v} kcal` : `${v} g`;
};
const WHO = { YOU: 'Vos', PATIENT: 'El paciente', OTHER: 'Otro nutricionista' };

const sum = (meals) => meals.reduce((a, m) => ({
  calories: a.calories + (m.totalCalories || 0),
  proteinG: a.proteinG + (m.totalProteinG || 0),
  carbsG: a.carbsG + (m.totalCarbsG || 0),
  fatG: a.fatG + (m.totalFatG || 0),
}), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

// Inicio de la ventana de 7 días: offset 0 = los últimos 7 días (incluye hoy).
function windowStartIso(offset) {
  return addDays(startOfDay(new Date()), -6 - 7 * offset).toISOString();
}

/** Ficha del paciente: hoy, semana, comidas con foto, peso, objetivo y metas. */
export default function PatientFileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0); // 0 = últimos 7 días; 1 = los 7 anteriores.
  const [selectedDay, setSelectedDay] = useState(6); // día elegido en el gráfico (6 = el último)
  const changeWeek = (next) => { setOffset(next); setSelectedDay(6); };
  const [mealsByOffset, setMealsByOffset] = useState({});
  const [removing, setRemoving] = useState(false);

  const today = startOfDay(new Date());
  const startKey = windowStartIso(offset);

  const loadMeals = useCallback(async (off, fromIso) => {
    const from = new Date(fromIso);
    const to = addDays(from, 7);
    to.setMilliseconds(-1);
    try {
      const res = await api(`/nutritionist/patients/${id}/meals?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      setMealsByOffset((prev) => ({ ...prev, [off]: res.meals }));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  const loadFile = useCallback(async () => {
    try {
      const res = await api(`/nutritionist/patients/${id}`);
      setFile(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  // Se recarga al volver (ej. después de editar las metas).
  useFocusEffect(useCallback(() => {
    loadFile();
    loadMeals(offset, startKey);
  }, [loadFile, loadMeals, offset, startKey]));

  const meals = mealsByOffset[offset];
  const todayMeals = (mealsByOffset[0] || []).filter((m) => sameDay(new Date(m.loggedAt), today));
  const todayTotals = sum(todayMeals);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(startKey), i);
    const dayMeals = (meals || []).filter((m) => sameDay(new Date(m.loggedAt), date));
    return { date, ...sum(dayMeals), count: dayMeals.length };
  }), [meals, startKey]);
  const day = days[selectedDay];

  const remove = () => confirm({
    title: 'Quitar paciente',
    message: `${file?.patient?.name || 'El paciente'} deja de estar vinculado y ya no vas a ver su información. Su valoración, si la dejó, se mantiene.`,
    confirmLabel: 'Quitar',
    onConfirm: async () => {
      setRemoving(true);
      try {
        await api(`/nutritionist/patients/${id}`, { method: 'DELETE' });
        router.back();
      } catch (err) {
        setError(err.message);
        setRemoving(false);
      }
    },
  });

  const p = file?.patient;
  const goalOpt = findOption(GOAL_OPTIONS, p?.goal);
  const activityOpt = findOption(ACTIVITY_OPTIONS, p?.activityLevel);
  const sexOpt = findOption(SEX_OPTIONS, p?.sex);

  return (
    <Screen onRefresh={async () => { await Promise.all([loadFile(), loadMeals(offset, startKey)]); }}>
      <BackHeader title="Ficha del paciente" />

      {error ? <Message>{error}</Message> : null}
      {!file && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {p ? (
        <>
          <Card style={styles.hero}>
            <Avatar uri={p.photoUrl} name={p.name} size={60} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.meta}>
                {[p.age ? `${p.age} años` : null, sexOpt?.label, p.heightCm ? `${p.heightCm} cm` : null, p.weightKg ? `${String(p.weightKg).replace('.', ',')} kg` : null].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.meta}>Vinculado desde el {new Date(p.since).toLocaleDateString('es-AR')}</Text>
              {p.isPremium ? <Badge tone="accent" label="NutriVision Pro" icon={<Crown size={11} color="#8A6212" />} style={{ alignSelf: 'flex-start', marginTop: 2 }} /> : null}
            </View>
          </Card>

          {/* Hoy */}
          <Card style={{ gap: 12 }}>
            <SectionHeader title="Hoy" />
            <View style={styles.today}>
              <CalorieRing consumed={todayTotals.calories} goal={p.dailyCalorieGoal} size={112} stroke={11} light={false} />
              <View style={{ flex: 1, gap: 9 }}>
                <MacroBar label="Proteínas" value={todayTotals.proteinG} goal={p.dailyProteinGoalG} color={colors.protein} />
                <MacroBar label="Carbs" value={todayTotals.carbsG} goal={p.dailyCarbsGoalG} color={colors.carbs} />
                <MacroBar label="Grasas" value={todayTotals.fatG} goal={p.dailyFatGoalG} color={colors.fats} />
              </View>
            </View>
            <Text style={styles.note}>{todayMeals.length ? `${todayMeals.length} ${todayMeals.length === 1 ? 'comida registrada' : 'comidas registradas'} hoy.` : 'Todavía no registró comidas hoy.'}</Text>
          </Card>

          {/* Semana */}
          <Card style={{ gap: 12 }}>
            <View style={styles.weekHead}>
              <Pressable onPress={() => changeWeek(offset + 1)} style={styles.navBtn} hitSlop={6} accessibilityLabel="Semana anterior">
                <ChevronLeft size={18} color={colors.ink} />
              </Pressable>
              <Text style={styles.weekTitle}>
                {offset === 0 ? 'Últimos 7 días' : `${days[0].date.getDate()}/${days[0].date.getMonth() + 1} – ${days[6].date.getDate()}/${days[6].date.getMonth() + 1}`}
              </Text>
              <Pressable onPress={() => changeWeek(Math.max(0, offset - 1))} disabled={offset === 0} style={[styles.navBtn, offset === 0 && { opacity: 0.3 }]} hitSlop={6} accessibilityLabel="Semana siguiente">
                <ChevronRight size={18} color={colors.ink} />
              </Pressable>
            </View>
            {meals === undefined ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
            ) : (
              <>
                <WeekBars days={days} goal={p.dailyCalorieGoal} selected={selectedDay} onSelect={setSelectedDay} />
                {/* Totales de macros del día elegido en el gráfico*/}
                <View style={styles.stats}>
                  <Stat label="Proteínas" value={day.proteinG} goal={p.dailyProteinGoalG} color={colors.protein} />
                  <Stat label="Carbs" value={day.carbsG} goal={p.dailyCarbsGoalG} color={colors.carbs} />
                  <Stat label="Grasas" value={day.fatG} goal={p.dailyFatGoalG} color={colors.fats} />
                </View>
                <Text style={styles.note}>
                  {day.count ? `${day.count} ${day.count === 1 ? 'comida registrada' : 'comidas registradas'} ese día.` : 'No registró comidas ese día.'} Tocá una barra para ver otro día.
                </Text>
              </>
            )}
          </Card>

          {/* Objetivo y metas */}
          <Card style={{ gap: 10 }}>
            <SectionHeader title="Objetivo y metas" />
            <View style={styles.goalRow}>
              <View style={styles.goalIcon}>{goalOpt ? <goalOpt.Icon size={18} color={colors.primary} /> : <Target size={18} color={colors.primary} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalLabel}>{goalOpt?.label ?? 'Sin objetivo'}</Text>
                <Text style={styles.meta}>{activityOpt ? `Actividad: ${activityOpt.label}` : ''}</Text>
              </View>
            </View>
            <View style={styles.goals}>
              <Goal label="Calorías" value={p.dailyCalorieGoal} unit="kcal" />
              <Goal label="Proteínas" value={p.dailyProteinGoalG} unit="g" />
              <Goal label="Carbs" value={p.dailyCarbsGoalG} unit="g" />
              <Goal label="Grasas" value={p.dailyFatGoalG} unit="g" />
            </View>
            <PrimaryButton label="Editar objetivo y metas" icon={<Pencil size={16} color="#fff" />} onPress={() => router.push(`/nutri-metas/${id}`)} />
            <Text style={styles.note}>Cuando cambies sus metas, {p.name.split(' ')[0]} va a ver un aviso en su app.</Text>
          </Card>

          {/* Peso */}
          <Card>
            <SectionHeader title="Evolución de peso" />
            {file.weightLogs.length > 1 ? (
              <WeightChart logs={file.weightLogs} />
            ) : (
              <Text style={styles.note}>Todavía no hay suficientes registros de peso para graficar.</Text>
            )}
          </Card>

          {/* Comidas del período */}
          <Card>
            <SectionHeader title={offset === 0 ? 'Comidas de los últimos 7 días' : 'Comidas de esa semana'} />
            {meals === undefined ? null : meals.length === 0 ? (
              <EmptyState icon={<Utensils size={24} color={colors.primary} />} title="Sin comidas registradas" text="No registró platos en estos días." />
            ) : (
              meals.map((m, i) => {
                const d = new Date(m.loggedAt);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push({ pathname: '/comida/[id]', params: { id: m.id, paciente: id } })}
                    style={({ pressed }) => [styles.meal, i === meals.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
                  >
                    {m.imageUrl ? <Image source={{ uri: m.imageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mealName} numberOfLines={1}>{m.name || 'Comida'}</Text>
                      <Text style={styles.meta}>{longDate(d)}, {pad(d.getHours())}:{pad(d.getMinutes())} h</Text>
                    </View>
                    <Text style={styles.mealKcal}>{Math.round(m.totalCalories || 0)} kcal</Text>
                    <ChevronRight size={16} color={colors.inkMuted} />
                  </Pressable>
                );
              })
            )}
          </Card>

          {/* Historial de cambios de metas */}
          {file.goalChanges.length ? (
            <Card style={{ gap: 4 }}>
              <View style={styles.histHead}>
                <History size={16} color={colors.inkSoft} />
                <Text style={styles.histTitle}>Cambios de objetivo y metas</Text>
              </View>
              {file.goalChanges.map((g) => (
                <View key={g.id} style={styles.hist}>
                  <Text style={styles.histMeta}>{WHO[g.by]} · {new Date(g.createdAt).toLocaleDateString('es-AR')}</Text>
                  {Object.entries(g.changes).map(([field, ch]) => (
                    <Text key={field} style={styles.histText}>
                      {FIELD_LABELS[field] || field}: {fmtValue(field, ch.from)} → <Text style={{ fontWeight: '800' }}>{fmtValue(field, ch.to)}</Text>
                    </Text>
                  ))}
                </View>
              ))}
            </Card>
          ) : null}

          <Pressable onPress={remove} disabled={removing} style={({ pressed }) => [styles.removeBtn, (pressed || removing) && { opacity: 0.7 }]}>
            <UserMinus size={18} color={colors.danger} />
            <Text style={styles.removeText}>{removing ? 'Quitando…' : 'Quitar paciente'}</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, goal, color }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <View style={[styles.statDot, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{Math.round(value)} g</Text>
      <Text style={styles.statGoal}>{goal ? `de ${goal} g` : 'sin meta'}</Text>
    </View>
  );
}

function Goal({ label, value, unit }) {
  return (
    <View style={styles.goal}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.goalValue}>{value ?? '—'} <Text style={styles.goalUnit}>{unit}</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft },
  note: { fontSize: 12, color: colors.inkMuted, lineHeight: 17 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, gap: 2 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statGoal: { fontSize: 11, color: colors.inkMuted },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  goalLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goal: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, gap: 2 },
  goalValue: { fontSize: 17, fontWeight: '800', color: colors.ink },
  goalUnit: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.bg },
  mealName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  mealKcal: { fontSize: 13, fontWeight: '800', color: colors.ink },
  histHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  histTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  hist: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, gap: 2 },
  histMeta: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  histText: { fontSize: 13, color: colors.ink },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft,
  },
  removeText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
