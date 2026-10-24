import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Card, Screen } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { CoachCard, MacroTotals } from '../../components/MealParts';
import { api } from '../../api/client';
import { longDate } from '../../utils/dates';
import { colors } from '../../theme';
import AdBanner from '../../components/AdBanner';

const pad = (n) => String(n).padStart(2, '0');

/** Detalle de un plato guardado: foto, totales, ingredientes y devolución del Coach. Solo lectura. */
export default function MealDetailScreen() {
  // `paciente`: el nutricionista abre un plato de uno de sus pacientes.
  const { id, paciente } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api(paciente ? `/nutritionist/patients/${paciente}/meals/${id}` : `/meals/${id}`);
      setMeal(data.meal);
    } catch (err) {
      setError(err.message);
    }
  }, [id, paciente]);

  useEffect(() => {
    load();
  }, [load]);

  const date = meal ? new Date(meal.loggedAt) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Volver">
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headTitle}>{paciente ? 'Plato del paciente' : 'Detalle del plato'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {error ? <Message>{error}</Message> : null}
      {!meal && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {meal ? (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.photo} accessibilityLabel={meal.name || 'Plato'} /> : null}
            <View style={{ padding: 14, gap: 10 }}>
              <View>
                <Text style={styles.name}>{meal.name || 'Plato registrado'}</Text>
                <Text style={styles.date}>{longDate(date)}, {pad(date.getHours())}:{pad(date.getMinutes())} h</Text>
              </View>
              <MacroTotals calories={meal.totalCalories} proteinG={meal.totalProteinG} carbsG={meal.totalCarbsG} fatG={meal.totalFatG} />
            </View>
          </Card>

          <Card>
            <Text style={styles.h3}>{meal.source === 'RECIPE' ? 'Receta registrada' : 'Ingredientes estimados'}</Text>
            {meal.ingredients.length === 0 ? <Text style={styles.ingGrams}>Sin ingredientes cargados.</Text> : null}
            {meal.ingredients.map((ing, i) => (
              <View key={ing.id} style={[styles.ingRow, i === meal.ingredients.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.ingTop}>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  {ing.grams > 0 ? <Text style={styles.ingGrams}>{Math.round(ing.grams)} g</Text> : null}
                </View>
                <Text style={styles.ingMacros}>
                  <Text style={{ color: colors.primary }}>{Math.round(ing.calories)} kcal</Text>
                  {'  ·  '}<Text style={{ color: colors.protein }}>{Math.round(ing.proteinG)}g P</Text>
                  {'  ·  '}<Text style={{ color: colors.carbs }}>{Math.round(ing.carbsG)}g C</Text>
                  {'  ·  '}<Text style={{ color: colors.fats }}>{Math.round(ing.fatG)}g G</Text>
                </Text>
              </View>
            ))}
          </Card>

          <CoachCard feedback={meal.coachFeedback} />
        </>
      ) : null}
    </Screen>
    {/* Banner del plan Gratuito (no se muestra a nutricionistas ni a Premium). */}
    <AdBanner style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  photo: { width: '100%', height: 240, backgroundColor: colors.bg },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  date: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  ingRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  ingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ingName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  ingGrams: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  ingMacros: { fontSize: 12, fontWeight: '700' },
});

