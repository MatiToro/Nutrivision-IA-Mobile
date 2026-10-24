import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChefHat, Clock, ExternalLink, Heart, Minus, Plus, ShoppingCart, Users, Utensils } from 'lucide-react-native';
import { Card, PrimaryButton, Screen } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { BackHeader } from '../../components/Nutritionist';
import { MacroTotals } from '../../components/MealParts';
import { FatSecretAttribution, SourceTag, haveLabel } from '../../components/Recipes';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { getRecipe, patchRecipe, rememberRecipes } from '../../utils/recipeStore';
import { colors, radius } from '../../theme';

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmt = (n) => String(n).replace('.', ',');

/** Detalle de una receta: ingredientes con "tengo / falta", pasos, faltantes a la lista y registrar como comida. */
export default function RecipeScreen() {
  const { key } = useLocalSearchParams();
  const router = useRouter();
  const { refreshData, replaceShopping } = useApp();

  const cached = getRecipe(key);
  const [recipe, setRecipe] = useState(cached?.detailed ? cached : null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shopMsg, setShopMsg] = useState(null);
  const [portions, setPortions] = useState(1);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api(`/recipes/${key}`, { timeout: 60000 });
      rememberRecipes([data.recipe]);
      setRecipe(data.recipe);
    } catch (err) {
      setError(err.message);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSaved = async () => {
    if (!recipe || saving) return;
    const next = !recipe.saved;
    setSaving(true);
    setActionError(null);
    setRecipe((r) => ({ ...r, saved: next }));
    try {
      if (next) await api('/recipes/saved', { method: 'POST', body: { key } });
      else await api(`/recipes/saved/${key}`, { method: 'DELETE' });
      patchRecipe(key, { saved: next });
    } catch (err) {
      setRecipe((r) => ({ ...r, saved: !next }));
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const missing = recipe ? recipe.ingredients.filter((i) => !i.have && !i.pantry) : [];

  const addMissing = async () => {
    setAdding(true);
    setActionError(null);
    setShopMsg(null);
    try {
      const items = missing.map((i) => ({ name: capitalize(i.name).slice(0, 60), quantity: (i.quantity || '1').slice(0, 30) }));
      const data = await api('/kitchen/shopping/bulk', { method: 'POST', body: { items } });
      replaceShopping(data.shopping);
      const parts = [];
      if (data.added.length) parts.push(`Se ${data.added.length === 1 ? 'agregó 1 producto' : `agregaron ${data.added.length} productos`} a tu lista de compras`);
      if (data.skipped.length) parts.push(`${data.skipped.length === 1 ? '1 ya estaba' : `${data.skipped.length} ya estaban`} en la lista`);
      setShopMsg(`${parts.join(' y ')}.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const logMeal = async () => {
    setLogging(true);
    setActionError(null);
    try {
      const data = await api('/recipes/log', { method: 'POST', body: { key, portions }, timeout: 60000 });
      setLogged(data.meal);
      refreshData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLogging(false);
    }
  };

  const per = recipe?.perServing || {};
  const time = recipe ? (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0) : 0;

  return (
    <Screen>
      <BackHeader
        title="Receta"
        right={recipe ? (
          <Pressable onPress={toggleSaved} hitSlop={10} style={styles.heartBtn} accessibilityLabel={recipe.saved ? 'Quitar de guardadas' : 'Guardar receta'} accessibilityState={{ selected: recipe.saved }}>
            <Heart size={20} color={recipe.saved ? colors.danger : colors.inkSoft} fill={recipe.saved ? colors.danger : 'transparent'} />
          </Pressable>
        ) : null}
      />

      {error ? (
        <Card style={{ gap: 12 }}>
          <Message>{error}</Message>
          <PrimaryButton label="Reintentar" onPress={load} variant="ghost" />
        </Card>
      ) : null}

      {!recipe && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{String(key).startsWith('fs-') ? 'Trayendo la receta de FatSecret y traduciéndola…' : 'Cargando la receta…'}</Text>
        </View>
      ) : null}

      {recipe ? (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.photo} accessibilityLabel={recipe.name} />
            ) : (
              <View style={[styles.photo, styles.photoIcon]}><ChefHat size={44} color={colors.primary} /></View>
            )}
            <View style={{ padding: 16, gap: 10 }}>
              <SourceTag source={recipe.source} />
              <Text style={styles.name}>{recipe.name}</Text>
              {recipe.description ? <Text style={styles.desc}>{recipe.description}</Text> : null}
              <View style={styles.metaRow}>
                {time ? <Meta icon={<Clock size={14} color={colors.inkSoft} />} text={`${time} min`} /> : null}
                {recipe.servings ? <Meta icon={<Users size={14} color={colors.inkSoft} />} text={`${fmt(recipe.servings)} ${recipe.servings === 1 ? 'porción' : 'porciones'}`} /> : null}
              </View>
              <Text style={styles.subTitle}>Por porción</Text>
              <MacroTotals calories={per.calories} proteinG={per.proteinG} carbsG={per.carbsG} fatG={per.fatG} />
              {recipe.source === 'AI' ? <Text style={styles.muted}>Valores estimados por IA.</Text> : null}
            </View>
          </Card>

          {actionError ? <Message>{actionError}</Message> : null}

          {/* Ingredientes: tengo / falta */}
          <Card style={{ gap: 4 }}>
            <View style={styles.cardHead}>
              <Text style={styles.h3}>Ingredientes</Text>
              <Text style={[styles.haveText, { color: missing.length ? '#8A6212' : colors.primaryDark }]}>{haveLabel(recipe)}</Text>
            </View>
            {recipe.ingredients.map((ing, i) => (
              <View key={`${ing.name}-${i}`} style={[styles.ingRow, i === recipe.ingredients.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.ingDot, ing.have ? styles.ingHave : styles.ingMissing]}>
                  {ing.have ? <Check size={12} color="#fff" strokeWidth={3} /> : <ShoppingCart size={11} color={colors.accent} />}
                </View>
                <Text style={[styles.ingText, !ing.have && { color: colors.ink }]}>{ing.text}</Text>
                {ing.pantry ? <Text style={styles.pantry}>despensa</Text> : !ing.have ? <Text style={styles.missingTag}>falta</Text> : null}
              </View>
            ))}
            {missing.length ? (
              <PrimaryButton
                label={adding ? 'Agregando…' : `Agregar ${missing.length === 1 ? 'el que falta' : `los ${missing.length} que faltan`} a mi lista`}
                icon={<ShoppingCart size={17} color="#fff" />}
                onPress={addMissing}
                disabled={adding}
                style={{ marginTop: 10 }}
              />
            ) : null}
            {shopMsg ? (
              <View style={{ marginTop: 8, gap: 6 }}>
                <Message tone="info">{shopMsg}</Message>
                <Pressable onPress={() => router.navigate({ pathname: '/cocina', params: { seccion: 'compras' } })} hitSlop={6}>
                  <Text style={styles.link}>Ver mi lista de compras</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>

          {/* Pasos */}
          <Card style={{ gap: 12 }}>
            <Text style={styles.h3}>Preparación</Text>
            {recipe.steps.length === 0 ? <Text style={styles.muted}>Esta receta no trae pasos.</Text> : null}
            {recipe.steps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </Card>

          {/* Registrar como comida de hoy */}
          <Card style={{ gap: 12 }}>
            <View style={styles.cardHead}>
              <Text style={styles.h3}>Registrar como comida de hoy</Text>
              <Utensils size={18} color={colors.primary} />
            </View>
            {logged ? (
              <>
                <Message tone="info">¡Listo! Se sumó a tus comidas de hoy: {Math.round(logged.totalCalories)} kcal.</Message>
                <PrimaryButton label="Ver el plato" variant="ghost" onPress={() => router.push({ pathname: '/comida/[id]', params: { id: logged.id } })} />
              </>
            ) : per.calories == null ? (
              <Text style={styles.muted}>Esta receta no trae información nutricional, así que no se puede registrar.</Text>
            ) : (
              <>
                <View style={styles.portionRow}>
                  <Text style={styles.portionLabel}>¿Cuánto comiste?</Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setPortions((p) => Math.max(0.5, p - 0.5))} disabled={portions <= 0.5} style={[styles.stepBtn, portions <= 0.5 && { opacity: 0.4 }]} accessibilityLabel="Menos porciones">
                      <Minus size={16} color={colors.ink} />
                    </Pressable>
                    <Text style={styles.portionValue}>{fmt(portions)} {portions === 1 ? 'porción' : 'porciones'}</Text>
                    <Pressable onPress={() => setPortions((p) => Math.min(10, p + 0.5))} disabled={portions >= 10} style={[styles.stepBtn, portions >= 10 && { opacity: 0.4 }]} accessibilityLabel="Más porciones">
                      <Plus size={16} color={colors.ink} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.muted}>
                  {Math.round(per.calories * portions)} kcal · P {Math.round((per.proteinG || 0) * portions)} g · C {Math.round((per.carbsG || 0) * portions)} g · G {Math.round((per.fatG || 0) * portions)} g
                </Text>
                <PrimaryButton
                  label={logging ? 'Registrando…' : 'Registrar como comida de hoy'}
                  icon={logging ? <ActivityIndicator color="#fff" size="small" /> : <Check size={17} color="#fff" />}
                  onPress={logMeal}
                  disabled={logging}
                />
                <Text style={styles.muted}>No hace falta sacar foto y no cuenta como escaneo.</Text>
              </>
            )}
          </Card>

          {recipe.source === 'FATSECRET' ? (
            <View style={{ alignItems: 'center', gap: 6 }}>
              {recipe.url ? (
                <Pressable onPress={() => Linking.openURL(recipe.url)} style={styles.origLink} hitSlop={6}>
                  <ExternalLink size={14} color={colors.primary} />
                  <Text style={styles.link}>Ver la receta original (en inglés)</Text>
                </Pressable>
              ) : null}
              <Text style={styles.muted}>Traducida al español con IA.</Text>
              <FatSecretAttribution />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Meta({ icon, text }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center', gap: 10, marginTop: 40 },
  photo: { width: '100%', height: 200, backgroundColor: colors.bg },
  photoIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, height: 140 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  desc: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  subTitle: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  muted: { fontSize: 12, color: colors.inkSoft, lineHeight: 17, textAlign: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  h3: { fontSize: 16, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  haveText: { fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  ingDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ingHave: { backgroundColor: colors.primary },
  ingMissing: { backgroundColor: colors.accentSoft },
  ingText: { flex: 1, fontSize: 14, color: colors.inkSoft, lineHeight: 19 },
  pantry: { fontSize: 11, fontWeight: '700', color: colors.inkMuted },
  missingTag: { fontSize: 11, fontWeight: '800', color: '#8A6212', backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  stepText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 21 },
  portionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  portionLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  portionValue: { fontSize: 14, fontWeight: '800', color: colors.ink, minWidth: 92, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  origLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
