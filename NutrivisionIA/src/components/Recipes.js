import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, ChefHat, Clock, Heart, Refrigerator, Sparkles } from 'lucide-react-native';
import { Card, EmptyState, PrimaryButton } from './ui';
import { Message } from './AuthUI';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { ensureRecipeOwner, getLastSuggestions, rememberRecipes, setLastSuggestions } from '../utils/recipeStore';
import { colors, radius, shadow } from '../theme';

const MEAL_TYPES = [
  { value: null, label: 'Cualquiera' },
  { value: 'BREAKFAST', label: 'Desayuno' },
  { value: 'LUNCH', label: 'Almuerzo' },
  { value: 'DINNER', label: 'Cena' },
  { value: 'SNACK', label: 'Snack' },
];
const TIMES = [
  { value: null, label: 'Sin límite' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
];
// 4 = "4 o más" (sin límite de faltantes)
const MISSING = [0, 1, 2, 3, 4].map((n) => ({ value: n, label: n === 0 ? 'Ninguno' : n === 4 ? '4+' : String(n) }));

export const FATSECRET_URL = 'https://platform.fatsecret.com';

/** "Powered by fatsecret": atribución obligatoria donde se muestran sus datos. */
export function FatSecretAttribution({ style }) {
  return (
    <Pressable onPress={() => Linking.openURL(FATSECRET_URL)} hitSlop={6} style={[styles.attribution, style]} accessibilityRole="link">
      <Text style={styles.attributionText}>Recetas de FatSecret · <Text style={styles.attributionLink}>Powered by fatsecret</Text></Text>
    </Pressable>
  );
}

/** Etiqueta de origen de la receta. */
export function SourceTag({ source }) {
  const ai = source === 'AI';
  return (
    <View style={[styles.tag, { backgroundColor: ai ? colors.primarySoft : colors.waterSoft }]}>
      {ai ? <Sparkles size={11} color={colors.primaryDark} /> : null}
      <Text style={[styles.tagText, { color: ai ? colors.primaryDark : '#0369A1' }]}>{ai ? 'Generada con IA' : 'FatSecret'}</Text>
    </View>
  );
}

/** "Tenés 5 de 7 ingredientes". */
export function haveLabel(r) {
  if (!r.totalCount) return 'Solo básicos de despensa';
  if (r.missingCount === 0) return 'Tenés todos los ingredientes';
  return `Tenés ${r.haveCount} de ${r.totalCount} ingredientes`;
}

const minutesLabel = (r) => {
  const m = (r.prepMinutes || 0) + (r.cookMinutes || 0);
  return m ? (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`) : null;
};

function RecipeCard({ recipe, onPress }) {
  const time = minutesLabel(recipe);
  const kcal = recipe.perServing?.calories;
  const complete = recipe.missingCount === 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={recipe.name}>
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbIcon]}><ChefHat size={26} color={colors.primary} /></View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.cardTop}>
          <SourceTag source={recipe.source} />
          {recipe.saved ? <Heart size={15} color={colors.danger} fill={colors.danger} /> : null}
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{recipe.name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[time, kcal != null ? `${Math.round(kcal)} kcal/porción` : null].filter(Boolean).join(' · ') || ' '}
        </Text>
        <View style={styles.haveRow}>
          {complete ? <Check size={13} color={colors.primary} strokeWidth={3} /> : <Refrigerator size={13} color={colors.accent} />}
          <Text style={[styles.haveText, { color: complete ? colors.primaryDark : '#8A6212' }]}>{haveLabel(recipe)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Recetas inteligentes (Premium). */
export default function RecipesPanel({ onGoToFridge }) {
  const router = useRouter();
  const { fridge, profile } = useApp();
  ensureRecipeOwner(profile?.id ?? null);

  const last = getLastSuggestions();
  const [filters, setFilters] = useState(last?.filters ?? { mealType: null, maxMinutes: null, maxMissing: 2, fitGoals: false });
  const [results, setResults] = useState(last?.list ?? null);
  const [fromCache, setFromCache] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);
  const [saved, setSaved] = useState(null);
  const [savedError, setSavedError] = useState(null);

  const loadSide = useCallback(async () => {
    try {
      setUsage(await api('/recipes/usage'));
    } catch {
      
    }
    try {
      const data = await api('/recipes/saved');
      rememberRecipes(data.recipes.filter((r) => !r.unavailable));
      setSaved(data.recipes);
      setSavedError(null);
    } catch (err) {
      setSavedError(err.message);
    }
  }, []);

  // Al volver del detalle se actualizan las guardadas.
  useFocusEffect(useCallback(() => {
    loadSide();
    const l = getLastSuggestions();
    if (l) setResults(l.list);
  }, [loadSide]));

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const suggest = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api('/recipes/suggest', { method: 'POST', body: filters, timeout: 90000 });
      setResults(data.recipes);
      setFromCache(data.fromCache);
      setLastSuggestions({ list: data.recipes, filters });
      setUsage((u) => ({ ...(u || {}), remainingToday: data.remainingToday, dailyLimit: data.dailyLimit }));
      if (data.fatsecret?.error) setNotice(data.fatsecret.error);
    } catch (err) {
      setError(err.message);
      if (err.status === 429) setUsage((u) => (u ? { ...u, remainingToday: 0 } : u));
    } finally {
      setLoading(false);
    }
  };

  const open = (r) => router.push({ pathname: '/receta/[key]', params: { key: r.key } });
  const hasFatSecret = (list) => (list || []).some((r) => r.source === 'FATSECRET');
  const noneLeft = usage?.remainingToday === 0;

  if (fridge.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Refrigerator size={24} color={colors.primary} />}
          title="Primero cargá tu heladera"
          text="Las recetas se arman con los alimentos que tenés. Agregá algunos y volvé."
        >
          <PrimaryButton label="Ir a mi heladera" onPress={onGoToFridge} style={{ marginTop: 14, alignSelf: 'stretch' }} />
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={styles.headRow}>
          <View style={styles.headIcon}><Sparkles size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle}>Recetas con tu heladera</Text>
            <Text style={styles.headSub}>Tenés {fridge.length} {fridge.length === 1 ? 'alimento' : 'alimentos'} cargados.</Text>
          </View>
        </View>

        <Text style={styles.label}>Comida</Text>
        <Chips options={MEAL_TYPES} value={filters.mealType} onChange={(v) => update({ mealType: v })} />
        <Text style={styles.label}>Tiempo máximo</Text>
        <Chips options={TIMES} value={filters.maxMinutes} onChange={(v) => update({ maxMinutes: v })} />
        <Text style={styles.label}>Ingredientes que pueden faltar</Text>
        <Chips options={MISSING} value={filters.maxMissing} onChange={(v) => update({ maxMissing: v })} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Que encaje en mis metas de hoy</Text>
            <Text style={styles.switchSub}>Usa las calorías y macros que te quedan.</Text>
          </View>
          <Switch
            value={filters.fitGoals}
            onValueChange={(v) => update({ fitGoals: v })}
            trackColor={{ true: colors.primaryLight, false: colors.line }}
            thumbColor="#fff"
            accessibilityLabel="Que encaje en mis metas de hoy"
          />
        </View>

        <PrimaryButton
          label={loading ? 'Buscando recetas…' : 'Sugerir recetas'}
          icon={loading ? <ActivityIndicator color="#fff" size="small" /> : <ChefHat size={18} color="#fff" />}
          onPress={suggest}
          disabled={loading || noneLeft}
        />
        {usage ? (
          <Text style={styles.usage}>
            {noneLeft
              ? 'Usaste las sugerencias de hoy. Mañana podés pedir más (tus guardadas siguen disponibles).'
              : `Te quedan ${usage.remainingToday} de ${usage.dailyLimit} sugerencias hoy. Si repetís la misma búsqueda, no se descuenta.`}
          </Text>
        ) : null}
        {loading ? <Text style={styles.usage}>La IA está armando recetas y buscando en FatSecret. Puede tardar unos segundos.</Text> : null}
      </Card>

      {error ? <Message>{error}</Message> : null}
      {notice ? <Message tone="info">{notice}</Message> : null}

      {results ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>
            Sugerencias ({results.length}){fromCache ? ' · las mismas de antes' : ''}
          </Text>
          {results.length === 0 ? (
            <Card><Text style={styles.usage}>No encontramos recetas con esos filtros. Probá permitir más ingredientes faltantes.</Text></Card>
          ) : (
            results.map((r) => <RecipeCard key={r.key} recipe={r} onPress={() => open(r)} />)
          )}
          {hasFatSecret(results) ? <FatSecretAttribution /> : null}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>Guardadas{saved ? ` (${saved.length})` : ''}</Text>
        {savedError ? <Message>{savedError}</Message> : null}
        {saved === null && !savedError ? <ActivityIndicator color={colors.primary} /> : null}
        {saved && saved.length === 0 ? (
          <Card>
            <View style={styles.emptySaved}>
              <Heart size={18} color={colors.inkMuted} />
              <Text style={[styles.usage, { flex: 1, textAlign: 'left' }]}>Tocá el corazón en una receta para guardarla y tenerla siempre a mano.</Text>
            </View>
          </Card>
        ) : null}
        {(saved || []).map((r) => (r.unavailable ? (
          <Pressable key={r.key} onPress={() => open(r)} style={[styles.card, { alignItems: 'center' }]}>
            <View style={[styles.thumb, styles.thumbIcon]}><Clock size={22} color={colors.inkMuted} /></View>
            <Text style={[styles.usage, { flex: 1, textAlign: 'left' }]}>Receta de FatSecret que no se pudo cargar ahora. Tocá para reintentar.</Text>
          </Pressable>
        ) : (
          <RecipeCard key={r.key} recipe={r} onPress={() => open(r)} />
        )))}
        {hasFatSecret(saved) ? <FatSecretAttribution /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  headSub: { fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: colors.primaryDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  switchTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  switchSub: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  usage: { fontSize: 12, color: colors.inkSoft, textAlign: 'center', lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 4 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, ...shadow.card },
  thumb: { width: 76, height: 76, borderRadius: 16, backgroundColor: colors.bg },
  thumbIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 15, fontWeight: '800', color: colors.ink, lineHeight: 19 },
  cardMeta: { fontSize: 12, color: colors.inkSoft },
  haveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  haveText: { fontSize: 12, fontWeight: '700' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: '800' },
  emptySaved: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attribution: { alignSelf: 'center', paddingVertical: 4 },
  attributionText: { fontSize: 11, color: colors.inkMuted },
  attributionLink: { color: colors.primary, fontWeight: '700' },
});
