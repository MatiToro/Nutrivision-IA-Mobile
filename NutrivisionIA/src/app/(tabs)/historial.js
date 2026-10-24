import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, History } from 'lucide-react-native';
import { Card, EmptyState, PrimaryButton, Screen, ScreenTitle } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { colors, radius, shadow } from '../../theme';
import { addDays, longDate, mondayOf, sameDay, shortDay, startOfDay } from '../../utils/dates';

/** Historial de comidas por día. */
export default function HistoryScreen() {
  const router = useRouter();
  const { fetchMeals, profile } = useApp();
  const today = startOfDay(new Date());
  const [selected, setSelected] = useState(today);
  // Comidas por semana, traídas del backend
  const [byWeek, setByWeek] = useState({});
  const [error, setError] = useState(null);

  const monday = mondayOf(selected);
  const weekKey = monday.toISOString();
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(weekKey), i)), [weekKey]);

  const loadWeek = useCallback(async (key) => {
    const from = new Date(key);
    const to = addDays(from, 7);
    to.setMilliseconds(-1);
    try {
      const list = await fetchMeals(from, to);
      setByWeek((prev) => ({ ...prev, [key]: list }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchMeals]);

  // Se recarga al entrar a la pestaña (después de guardar o borrar un plato) y al cambiar de semana.
  useFocusEffect(useCallback(() => {
    if (profile?.id) loadWeek(weekKey);
  }, [weekKey, loadWeek, profile?.id]));

  const meals = byWeek[weekKey] ?? [];
  const loading = byWeek[weekKey] === undefined && !error;

  const dayMeals = meals.filter((m) => sameDay(new Date(m.loggedAt), selected));
  const totals = dayMeals.reduce(
    (a, m) => ({
      kcal: a.kcal + (m.totalCalories || 0),
      p: a.p + (m.totalProteinG || 0),
      c: a.c + (m.totalCarbsG || 0),
      f: a.f + (m.totalFatG || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const hasMeals = (d) => meals.some((m) => sameDay(new Date(m.loggedAt), d));
  const isToday = sameDay(selected, today);

  return (
    <Screen onRefresh={() => loadWeek(weekKey)}>
      <ScreenTitle title="Historial" subtitle="Revisá lo que comiste día a día." />

      <Card style={{ gap: 14 }}>
        <View style={styles.weekNav}>
          <Pressable onPress={() => setSelected(addDays(selected, -7))} hitSlop={8} style={styles.navBtn} accessibilityLabel="Semana anterior">
            <ChevronLeft size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.weekTitle}>{longDate(selected)}</Text>
          <Pressable
            onPress={() => setSelected(new Date(Math.min(addDays(selected, 7).getTime(), today.getTime())))}
            disabled={isToday}
            hitSlop={8}
            style={[styles.navBtn, isToday && { opacity: 0.35 }]}
            accessibilityLabel="Semana siguiente"
          >
            <ChevronRight size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.days}>
          {week.map((d) => {
            const future = d > today;
            const active = sameDay(d, selected);
            return (
              <Pressable
                key={d.toISOString()}
                disabled={future}
                onPress={() => setSelected(d)}
                style={[styles.day, active && styles.dayActive, future && { opacity: 0.35 }]}
              >
                <Text style={[styles.dayLetter, active && styles.dayTextActive]}>{shortDay(d)}</Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.getDate()}</Text>
                <View style={[styles.dayDot, hasMeals(d) && { backgroundColor: active ? '#fff' : colors.primary }]} />
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.summary}>
        {[
          { label: 'kcal', value: totals.kcal, color: colors.primary },
          { label: 'Prot.', value: totals.p, color: colors.protein, unit: 'g' },
          { label: 'Carbs', value: totals.c, color: colors.carbs, unit: 'g' },
          { label: 'Grasas', value: totals.f, color: colors.fats, unit: 'g' },
        ].map((s) => (
          <View key={s.label} style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: s.color }]}>{Math.round(s.value)}{s.unit ?? ''}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Card>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : dayMeals.length === 0 ? (
          <EmptyState
            icon={<History size={24} color={colors.primary} />}
            title={isToday ? 'Sin comidas registradas hoy' : 'Sin comidas este día'}
            text="Cada plato que escanees y guardes aparecerá acá con su foto, calorías y macros."
          >
            {isToday ? (
              <PrimaryButton label="Escanear un plato" onPress={() => router.push('/escanear')} style={{ marginTop: 14, alignSelf: 'stretch' }} />
            ) : null}
          </EmptyState>
        ) : (
          dayMeals.map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/comida/${m.id}`)} style={({ pressed }) => [styles.mealRow, pressed && { opacity: 0.7 }]}>
              {m.imageUrl ? <Image source={{ uri: m.imageUrl }} style={styles.thumb} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName} numberOfLines={1}>{m.name || 'Comida'}</Text>
                <Text style={styles.mealMacros}>
                  <Text style={{ color: colors.protein }}>P {Math.round(m.totalProteinG)}g</Text>
                  {'  ·  '}<Text style={{ color: colors.carbs }}>C {Math.round(m.totalCarbsG)}g</Text>
                  {'  ·  '}<Text style={{ color: colors.fats }}>G {Math.round(m.totalFatG)}g</Text>
                </Text>
              </View>
              <Text style={styles.mealKcal}>{Math.round(m.totalCalories)} kcal</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  weekTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, gap: 3 },
  dayActive: { backgroundColor: colors.primary },
  dayLetter: { fontSize: 11, fontWeight: '700', color: colors.inkSoft },
  dayNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  dayTextActive: { color: '#fff' },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  summary: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', ...shadow.card },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.bg },
  mealMacros: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  mealName: { fontWeight: '700', color: colors.ink },
  mealKcal: { fontWeight: '700', color: colors.ink },
});
