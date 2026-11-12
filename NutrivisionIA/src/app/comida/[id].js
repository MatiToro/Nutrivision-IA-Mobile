import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { Card, PrimaryButton, Screen } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { CoachCard, MacroTotals } from '../../components/MealParts';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { longDate } from '../../utils/dates';
import { colors, radius } from '../../theme';
import AdBanner, { useShowAds } from '../../components/AdBanner';
import { preloadInterstitial, showInterstitialIfReady } from '../../utils/ads';

const pad = (n) => String(n).padStart(2, '0');

// Porciones al repetir una comida (1 = igual que la original).
const PORTIONS = [
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
];

/**
 * Detalle de un plato guardado: foto, totales, ingredientes y devolución del Coach.
 * El paciente puede "Registrar de nuevo" el plato hoy (no gasta escaneos).
 * Con ?repetir=1 (desde el escáner o el historial) la opción aparece arriba de todo.
 */
export default function MealDetailScreen() {
  // `paciente`: el nutricionista abre un plato de uno de sus pacientes.
  const { id, paciente, repetir } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshData } = useApp();
  const showAds = useShowAds();
  const [meal, setMeal] = useState(null);
  const [viewerIsPremium, setViewerIsPremium] = useState(true);
  const [error, setError] = useState(null);
  const [portions, setPortions] = useState(1);
  const [repeating, setRepeating] = useState(false);
  const [repeatError, setRepeatError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api(paciente ? `/nutritionist/patients/${paciente}/meals/${id}` : `/meals/${id}`);
      setMeal(data.meal);
      setViewerIsPremium(data.viewerIsPremium !== false);
    } catch (err) {
      setError(err.message);
    }
  }, [id, paciente]);

  useEffect(() => {
    load();
  }, [load]);

  // Plan Gratuito: el anuncio de pantalla completa se precarga y se muestra
  // después de registrar la comida repetida (igual que al guardar un escaneo).
  useEffect(() => {
    if (showAds && !paciente) preloadInterstitial();
  }, [showAds, paciente]);

  async function repeatMeal() {
    setRepeating(true);
    setRepeatError(null);
    try {
      const data = await api(`/meals/${id}/repeat`, { method: 'POST', body: { portions }, timeout: 60000 });
      await refreshData(); // comidas de hoy, racha y progreso
      router.replace(`/comida/${data.meal.id}`);
      if (showAds) showInterstitialIfReady();
    } catch (err) {
      setRepeatError(err.message);
    } finally {
      setRepeating(false);
    }
  }

  const date = meal ? new Date(meal.loggedAt) : null;
  const canRepeat = Boolean(meal) && !paciente;

  const repeatCard = canRepeat ? (
    <Card style={{ gap: 10 }}>
      <View style={styles.repeatHead}>
        <View style={styles.repeatIcon}><RotateCcw size={16} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.h3NoMargin}>¿Lo volviste a comer?</Text>
          <Text style={styles.hint}>Registralo hoy sin sacar foto: no gasta escaneos.</Text>
        </View>
      </View>
      <Text style={styles.label}>Porciones</Text>
      <View style={styles.portions}>
        {PORTIONS.map((p) => {
          const active = portions === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => setPortions(p.value)}
              style={[styles.portion, active && styles.portionActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.portionText, active && styles.portionTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {Math.round((meal.totalCalories || 0) * portions)} kcal · {Math.round((meal.totalProteinG || 0) * portions)} g de proteína
      </Text>
      {repeatError ? <Message>{repeatError}</Message> : null}
      <PrimaryButton
        label={repeating ? 'Registrando…' : 'Registrar de nuevo hoy'}
        icon={<RotateCcw size={16} color="#fff" />}
        onPress={repeatMeal}
        disabled={repeating}
      />
    </Card>
  ) : null;

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
          {repetir ? repeatCard : null}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.photo} accessibilityLabel={meal.name || 'Plato'} /> : null}
            <View style={{ padding: 14, gap: 10 }}>
              <View>
                <Text style={styles.name}>{meal.name || 'Plato registrado'}</Text>
                <Text style={styles.date}>
                  {longDate(date)}, {pad(date.getHours())}:{pad(date.getMinutes())} h
                  {meal.source === 'REPEAT' ? ' · Repetida' : ''}
                </Text>
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

          <CoachCard
            feedback={meal.coachFeedback}
            upsell={!paciente && !viewerIsPremium}
            onUpgrade={() => router.push('/premium')}
          />

          {!repetir ? repeatCard : null}
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
  h3NoMargin: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  repeatHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repeatIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  portions: { flexDirection: 'row', gap: 8 },
  portion: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface,
  },
  portionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  portionText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  portionTextActive: { color: colors.primaryDark },
  ingRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  ingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ingName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  ingGrams: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  ingMacros: { fontSize: 12, fontWeight: '700' },
});
