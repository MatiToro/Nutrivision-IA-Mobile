import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChefHat, ChevronLeft, ChevronRight, Flag, Utensils } from 'lucide-react-native';
import { Card, Screen } from '../components/ui';
import { BackHeader } from '../components/Nutritionist';
import { Message } from '../components/AuthUI';
import { MacroBar } from '../components/Nutrition';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { GOAL_OPTIONS, findOption } from '../constants/profile';
import { colors, radius } from '../theme';
import { addDays, longDate, mondayOf, sameDay, shortDay, startOfDay, todayKey } from '../utils/dates';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEK_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CHART_HEIGHT = 150;

// Estado de cada día respecto de la meta calórica
const STATUS = {
  ok: { label: 'En la meta', color: colors.primary, soft: colors.primarySoft },
  low: { label: 'Por debajo', color: colors.accent, soft: colors.accentSoft },
  over: { label: 'Se pasó', color: colors.danger, soft: colors.dangerSoft },
  none: { label: 'Sin registro', color: colors.line, soft: colors.bg },
};

/** Verde: entre 80 % y 110 % de la meta · amarillo: por debajo · rojo: más de 110 %. */
function dayStatus(calories, goal) {
  if (!calories) return 'none';
  if (!goal) return 'ok';
  if (calories > goal * 1.1) return 'over';
  if (calories < goal * 0.8) return 'low';
  return 'ok';
}

const pad = (n) => String(n).padStart(2, '0');
const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const periodKey = (mode, start) => `${mode}:${todayKey(start)}`;

function weekLabel(start) {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}
const monthLabel = (start) => `${MONTHS[start.getMonth()].charAt(0).toUpperCase()}${MONTHS[start.getMonth()].slice(1)} ${start.getFullYear()}`;

/** Gráfico de calorías semanal y mensual. */
export default function ProgressScreen() {
  const router = useRouter();
  const { profile } = useApp();
  const today = startOfDay(new Date());
  const goal = profile?.dailyCalorieGoal || null;

  const [mode, setMode] = useState('week'); // 'week' | 'month'
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [periods, setPeriods] = useState({});
  const [days, setDays] = useState({}); // comidas completas (con foto) por día
  const [error, setError] = useState(null);

  const start = mode === 'week' ? mondayOf(anchor) : firstOfMonth(anchor);
  const end = mode === 'week' ? addDays(start, 7) : addMonths(start, 1);
  const key = periodKey(mode, start);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // Etapa actual: desde el alta de objetivos o el último cambio de objetivo (si no hay
  // dato, desde la creación de la cuenta). No se puede ir más atrás de esa fecha y los
  // días anteriores no cuentan: tenían otro objetivo y otra meta.
  const stageStart = profile?.goalStartedAt || profile?.createdAt;
  const created = stageStart ? startOfDay(new Date(stageStart)) : null;
  const createdIso = created ? created.toISOString() : null;
  const canPrev = !created || start > (mode === 'week' ? mondayOf(created) : firstOfMonth(created));
  const canNext = end <= today;

  const loadPeriod = useCallback(async (k, fromIso, toIso) => {
    const to = new Date(toIso);
    to.setMilliseconds(-1);
    try {
      const data = await api(`/history/meals?fields=summary&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(to.toISOString())}`);
      setPeriods((p) => ({ ...p, [k]: data.meals ?? [] }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const selectedIso = selected.toISOString();
  const loadDay = useCallback(async (iso) => {
    const from = new Date(iso);
    const to = addDays(from, 1);
    to.setMilliseconds(-1);
    try {
      const data = await api(`/history/meals?from=${encodeURIComponent(iso)}&to=${encodeURIComponent(to.toISOString())}`);
      setDays((d) => ({ ...d, [iso]: data.meals ?? [] }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Al entrar (o volver del detalle de un plato) se recarga lo que se ve.
  useFocusEffect(useCallback(() => {
    if (!profile?.id) return;
    loadPeriod(key, startIso, endIso);
    loadDay(selectedIso);
  }, [profile?.id, key, startIso, endIso, selectedIso, loadPeriod, loadDay]));

  const meals = periods[key];
  const loading = meals === undefined && !error;

  // Totales por día del período
  const dayList = useMemo(() => {
    const list = [];
    for (let d = new Date(startIso); d < new Date(endIso); d = addDays(d, 1)) {
      const dayMeals = (meals || []).filter((m) => sameDay(new Date(m.loggedAt), d));
      const calories = dayMeals.reduce((a, m) => a + (m.totalCalories || 0), 0);
      // Días futuros o anteriores a la creación de la cuenta: no se pueden elegir ni cuentan.
      const outside = d > today || (createdIso && d < new Date(createdIso));
      list.push(outside
        ? { date: d, calories: 0, count: 0, status: 'none', future: true }
        : { date: d, calories, count: dayMeals.length, status: dayStatus(calories, goal), future: false });
    }
    return list;

  }, [meals, startIso, endIso, goal, createdIso, todayKey(today)]);

  const elapsed = dayList.filter((d) => !d.future);
  const logged = elapsed.filter((d) => d.count > 0);
  const average = logged.length ? Math.round(logged.reduce((a, d) => a + d.calories, 0) / logged.length) : 0;
  const onGoal = logged.filter((d) => d.status === 'ok').length;

  // Cambiar de período: queda elegido el último día ya transcurrido de ese período.
  const goTo = (newAnchor, newMode = mode) => {
    const s = newMode === 'week' ? mondayOf(newAnchor) : firstOfMonth(newAnchor);
    const e = newMode === 'week' ? addDays(s, 6) : addDays(addMonths(s, 1), -1);
    setMode(newMode);
    setAnchor(s);
    let pick = today < e ? (today >= s ? today : s) : e;
    if (created && pick < created) pick = created;
    setSelected(pick);
  };
  const move = (dir) => goTo(mode === 'week' ? addDays(start, 7 * dir) : addMonths(start, dir));
  const switchMode = (m) => {
    if (m === mode) return;
    // Al cambiar de vista se mantiene el día elegido.
    const s = m === 'week' ? mondayOf(selected) : firstOfMonth(selected);
    setMode(m);
    setAnchor(s);
  };

  return (
    <Screen onRefresh={() => Promise.all([loadPeriod(key, startIso, endIso), loadDay(selectedIso)])}>
      <BackHeader title="Mi progreso" />

      {/* Semana | Mes */}
      <View style={styles.segment}>
        {[['week', 'Semana'], ['month', 'Mes']].map(([m, label]) => (
          <Pressable key={m} onPress={() => switchMode(m)} style={[styles.segBtn, mode === m && styles.segBtnActive]} accessibilityState={{ selected: mode === m }}>
            <Text style={[styles.segText, mode === m && styles.segTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {created ? (
        <View style={styles.stage}>
          <Flag size={16} color={colors.primaryDark} />
          <Text style={styles.stageText}>
            Etapa actual{findOption(GOAL_OPTIONS, profile?.goal) ? `: ${findOption(GOAL_OPTIONS, profile.goal).label}` : ''}
            <Text style={styles.stageSince}> · desde el {created.getDate()} de {MONTHS[created.getMonth()]}</Text>
          </Text>
        </View>
      ) : null}

      <Card style={{ gap: 14 }}>
        <View style={styles.nav}>
          <Pressable onPress={() => move(-1)} disabled={!canPrev} style={[styles.navBtn, !canPrev && styles.disabled]} accessibilityLabel={mode === 'week' ? 'Semana anterior' : 'Mes anterior'} hitSlop={6}>
            <ChevronLeft size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.navLabel}>{mode === 'week' ? weekLabel(start) : monthLabel(start)}</Text>
          <Pressable onPress={() => move(1)} disabled={!canNext} style={[styles.navBtn, !canNext && styles.disabled]} accessibilityLabel={mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'} hitSlop={6}>
            <ChevronRight size={20} color={colors.ink} />
          </Pressable>
        </View>

        {/* Resumen del período */}
        <View style={styles.stats}>
          <Stat value={logged.length ? `${average}` : '—'} unit={logged.length ? 'kcal' : ''} label="Promedio diario" />
          <Stat value={`${logged.length}/${elapsed.length || dayList.length}`} label="Días registrados" />
          <Stat value={goal ? `${onGoal}` : '—'} label="Días en la meta" />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
        ) : mode === 'week' ? (
          <WeekChart days={dayList} goal={goal} selected={selected} onSelect={setSelected} />
        ) : (
          <MonthCalendar days={dayList} selected={selected} onSelect={setSelected} />
        )}

        <Legend />
        {!goal ? <Text style={styles.hint}>Cuando tengas una meta diaria, los días se van a comparar con ella.</Text> : null}
        <Text style={styles.hint}>Al cambiar de objetivo empieza una etapa nueva: los días anteriores quedan apagados y no se cuentan (siguen en tu Historial).</Text>
      </Card>

      {error ? <Message>{error}</Message> : null}

      <DaySummary
        date={selected}
        meals={days[selectedIso]}
        goal={profile}
        onOpenMeal={(id) => router.push({ pathname: '/comida/[id]', params: { id } })}
      />
    </Screen>
  );
}

function Stat({ value, unit, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>{value}{unit ? <Text style={styles.statUnit}> {unit}</Text> : null}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      {Object.entries(STATUS).map(([k, s]) => (
        <View key={k} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: s.color }]} />
          <Text style={styles.legendText}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** 7 barras (lunes a domingo) con la meta como línea punteada. */
function WeekChart({ days, goal, selected, onSelect }) {
  const top = Math.max(goal || 0, ...days.map((d) => d.calories), 1) * 1.15;
  const goalY = goal ? CHART_HEIGHT - (goal / top) * CHART_HEIGHT : null;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.chart}>
        {goalY != null ? (
          <View style={[styles.goalLine, { top: goalY }]}>
            <Text style={styles.goalText}>meta {goal}</Text>
          </View>
        ) : null}
        {days.map((d) => {
          const active = sameDay(d.date, selected);
          const h = d.calories ? Math.max((d.calories / top) * CHART_HEIGHT, 4) : 0;
          return (
            <Pressable
              key={d.date.toISOString()}
              onPress={() => onSelect(d.date)}
              disabled={d.future}
              style={styles.col}
              accessibilityLabel={`${longDate(d.date)}: ${Math.round(d.calories)} kilocalorías`}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.barArea, active && styles.barAreaActive]}>
                {d.calories ? <Text style={[styles.barValue, active && { color: colors.ink }]}>{Math.round(d.calories)}</Text> : null}
                <View style={[styles.bar, { height: h, backgroundColor: STATUS[d.status].color }, !active && { opacity: 0.6 }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {days.map((d) => {
          const active = sameDay(d.date, selected);
          return (
            <Text key={d.date.toISOString()} style={[styles.label, active && styles.labelActive, d.future && { opacity: 0.4 }]}>
              {shortDay(d.date)}{'\n'}{d.date.getDate()}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/** Calendario del mes: cada día con el color de cómo le fue. */
function MonthCalendar({ days, selected, onSelect }) {
  const offset = (days[0].date.getDay() + 6) % 7; // lunes = 0
  const cells = [...Array(offset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.calRow}>
        {WEEK_LETTERS.map((l) => <Text key={l} style={styles.calHead}>{l}</Text>)}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={styles.calRow}>
          {row.map((d, c) => {
            if (!d) return <View key={c} style={styles.calCell} />;
            const s = STATUS[d.status];
            const active = sameDay(d.date, selected);
            return (
              <Pressable
                key={c}
                onPress={() => onSelect(d.date)}
                disabled={d.future}
                style={[styles.calCell, styles.calDay, { backgroundColor: d.future ? 'transparent' : s.soft }, active && { borderColor: colors.ink }]}
                accessibilityLabel={`${longDate(d.date)}: ${d.count ? `${Math.round(d.calories)} kilocalorías` : 'sin registro'}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.calNum, d.future && { color: colors.inkMuted }, active && { fontWeight: '800' }]}>{d.date.getDate()}</Text>
                {d.count && d.status !== 'none' ? <View style={[styles.calDot, { backgroundColor: s.color }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Resumen del día elegido: calorías vs meta, macros y comidas. */
function DaySummary({ date, meals, goal: user, onOpenMeal }) {
  const isToday = sameDay(date, new Date());
  const t = (meals || []).reduce((a, m) => ({
    kcal: a.kcal + (m.totalCalories || 0),
    p: a.p + (m.totalProteinG || 0),
    c: a.c + (m.totalCarbsG || 0),
    f: a.f + (m.totalFatG || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  const goal = user?.dailyCalorieGoal;
  const status = STATUS[dayStatus(t.kcal, goal)];
  const pct = goal ? Math.min(t.kcal / goal, 1) : 0;

  return (
    <Card style={{ gap: 14 }}>
      <View>
        <Text style={styles.dayTitle}>{isToday ? 'Hoy' : longDate(date)}</Text>
        {isToday ? <Text style={styles.hint}>{longDate(date)}</Text> : null}
      </View>

      {meals === undefined ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <View style={styles.kcalRow}>
              <Text style={styles.kcalValue}>{Math.round(t.kcal)}<Text style={styles.kcalGoal}>{goal ? ` / ${goal} kcal` : ' kcal'}</Text></Text>
              {meals.length ? <View style={[styles.statusPill, { backgroundColor: status.soft }]}><Text style={[styles.statusText, { color: status.color === colors.line ? colors.inkSoft : status.color }]}>{status.label}</Text></View> : null}
            </View>
            {goal ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: status.color }]} />
              </View>
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <MacroBar label="Proteínas" value={t.p} goal={user?.dailyProteinGoalG} color={colors.protein} />
            <MacroBar label="Carbohidratos" value={t.c} goal={user?.dailyCarbsGoalG} color={colors.carbs} />
            <MacroBar label="Grasas" value={t.f} goal={user?.dailyFatGoalG} color={colors.fats} />
          </View>

          <View>
            <Text style={styles.mealsTitle}>Comidas ({meals.length})</Text>
            {meals.length === 0 ? (
              <View style={styles.noMeals}>
                <Utensils size={18} color={colors.inkMuted} />
                <Text style={styles.hint}>No registraste comidas este día.</Text>
              </View>
            ) : (
              [...meals].sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt)).map((m, i) => {
                const d = new Date(m.loggedAt);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => onOpenMeal(m.id)}
                    style={({ pressed }) => [styles.meal, i === meals.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
                  >
                    {m.imageUrl ? (
                      <Image source={{ uri: m.imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbIcon]}><ChefHat size={20} color={colors.primary} /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName} numberOfLines={1}>{m.name || 'Plato registrado'}</Text>
                      <Text style={styles.mealMeta}>{pad(d.getHours())}:{pad(d.getMinutes())} h · P {Math.round(m.totalProteinG || 0)} · C {Math.round(m.totalCarbsG || 0)} · G {Math.round(m.totalFatG || 0)}</Text>
                    </View>
                    <Text style={styles.mealKcal}>{Math.round(m.totalCalories || 0)} kcal</Text>
                    <ChevronRight size={16} color={colors.inkMuted} />
                  </Pressable>
                );
              })
            )}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  stageText: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  stageSince: { fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.primary },
  segText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  segTextActive: { color: '#fff' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  navLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statUnit: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2, textAlign: 'center' },
  chart: { height: CHART_HEIGHT + 18, flexDirection: 'row', gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line, paddingTop: 18 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inkMuted },
  goalText: { position: 'absolute', right: 0, top: -15, fontSize: 10, fontWeight: '700', color: colors.inkMuted },
  col: { flex: 1 },
  barArea: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', borderRadius: radius.sm },
  barAreaActive: { backgroundColor: colors.bg },
  barValue: { fontSize: 9, fontWeight: '700', color: colors.inkMuted, marginBottom: 2 },
  bar: { width: '78%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  labels: { flexDirection: 'row', gap: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.inkMuted, lineHeight: 14 },
  labelActive: { color: colors.ink, fontWeight: '800' },
  calRow: { flexDirection: 'row', gap: 6 },
  calHead: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.inkMuted },
  calCell: { flex: 1, aspectRatio: 1 },
  calDay: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', gap: 2 },
  calNum: { fontSize: 13, fontWeight: '600', color: colors.ink },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  dayTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  kcalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kcalValue: { fontSize: 24, fontWeight: '800', color: colors.ink },
  kcalGoal: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 12, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  mealsTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  noMeals: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, justifyContent: 'center' },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.bg },
  thumbIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  mealName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  mealMeta: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  mealKcal: { fontSize: 13, fontWeight: '800', color: colors.ink },
});
