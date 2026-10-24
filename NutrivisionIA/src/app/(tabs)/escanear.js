import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ArrowLeft, Camera, Crown, ImagePlus, Lightbulb, Pencil, Sparkles, X } from 'lucide-react-native';
import { Badge, Card, PrimaryButton, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import IngredientEditor from '../../components/IngredientEditor';
import { CoachCard, MacroTotals } from '../../components/MealParts';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  ingredientsSignature, stripClientFields, sumIngredients, withBasis,
} from '../../utils/ingredients';
import { appendImage } from '../../utils/formImage';
import { colors, radius } from '../../theme';
import { useShowAds } from '../../components/AdBanner';
import { preloadInterstitial, showInterstitialIfReady } from '../../utils/ads';

const logo = require('../../../assets/logo.png');
const MAX_SIDE = 1280; // la foto se achica antes de subirla (el backend igual la lleva a 1024 px)

const TIPS = [
  'Buena luz: mejor luz natural y sin sombras fuertes sobre el plato.',
  'Encuadrá el plato completo, desde arriba o con un ángulo leve.',
  'Un plato por foto para que la IA estime mejor las porciones.',
];

/**
 * Escáner de platos, mismo flujo de dos fases que la Web:
 * 1) Foto (cámara o galería) → POST /meals/analyze: Gemini + FatSecret + Coach. No se guarda nada.
 * 2) El usuario revisa/edita ingredientes, le pone nombre y confirma → POST /meals (recién ahí se guarda).
 */
export default function ScanScreen() {
  const router = useRouter();
  const { isPremium, scansToday, freeDailyScanLimit: limit, refreshData } = useApp();
  // Plan Gratuito: el anuncio de pantalla completa se deja cargado de antemano y se
  // muestra recién cuando la comida ya se guardó (nunca corta el análisis).
  const showAds = useShowAds();
  useEffect(() => {
    if (showAds) preloadInterstitial();
  }, [showAds]);
  const left = Math.max(limit - scansToday, 0);
  const limitReached = !isPremium && left === 0;

  const [photo, setPhoto] = useState(null); // { uri, source }
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [plateName, setPlateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [coachUpdating, setCoachUpdating] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const coachRequestId = useRef(0);

  // ---------- 1) Elegir foto ----------
  async function pickImage(source) {
    setError(null);
    try {
      if (source === 'MOBILE_CAMERA') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Necesitamos permiso para usar la cámara. Podés habilitarlo en los ajustes del teléfono.');
          return;
        }
      }
      const options = { mediaTypes: ['images'], quality: 0.9, exif: false };
      const result = source === 'MOBILE_CAMERA'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uri = await shrink(asset);
      setPhoto({ uri, source });
      analyze(uri);
    } catch (err) {
      setError(`No pudimos abrir la ${source === 'MOBILE_CAMERA' ? 'cámara' : 'galería'}: ${err.message}`);
    }
  }

  // ---------- 2) Analizar con IA ----------
  async function analyze(uri) {
    setAnalyzing(true);
    try {
      const body = new FormData();
      await appendImage(body, 'image', uri);
      const data = await api('/meals/analyze', { method: 'POST', body, timeout: 90000 });
      setAnalysis({ ...data, ingredients: data.ingredients.map(withBasis) });
      setCoachError(null);
      if (data.dishName) setPlateName(data.dishName);
    } catch (err) {
      setError(err.message);
      setPhoto(null);
      if (err.status === 403) refreshData();
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setPlateName('');
    setEditing(false);
    setCoachError(null);
    setCoachUpdating(false);
    coachRequestId.current += 1;
  }

  // ---------- Edición de ingredientes ----------
  const lookupsPending = draft.some((i) => i._lookup === 'pending');

  function startEditing() {
    setDraft(analysis.ingredients.map((i) => ({ ...i })));
    setEditing(true);
  }

  function applyEdits() {
    if (lookupsPending) return;
    const cleaned = draft
      .map((i) => ({ ...i, _lookup: undefined, _lookupError: undefined }))
      .filter((i) => String(i.name).trim());
    if (cleaned.length === 0) {
      setError('El plato necesita al menos un ingrediente con nombre.');
      return;
    }
    setError(null);
    const changed = ingredientsSignature(cleaned) !== ingredientsSignature(analysis.ingredients);
    setAnalysis((a) => ({ ...a, ingredients: cleaned, totals: sumIngredients(cleaned) }));
    setEditing(false);
    if (changed) regenerateCoach(cleaned); // el consejo tiene que corresponder al plato final
  }

  async function regenerateCoach(ingredients) {
    coachRequestId.current += 1;
    const requestId = coachRequestId.current;
    setCoachUpdating(true);
    setCoachError(null);
    try {
      const data = await api('/meals/coach', {
        method: 'POST',
        body: { dishName: plateName.trim(), ingredients: ingredients.map(stripClientFields) },
        timeout: 60000,
      });
      if (requestId !== coachRequestId.current) return;
      setAnalysis((a) => (a ? { ...a, coachFeedback: data.coachFeedback, coachMocked: data.coachMocked } : a));
    } catch (err) {
      if (requestId !== coachRequestId.current) return;
      setCoachError(`No se pudo actualizar la devolución del Coach (${err.message}). La que ves corresponde al plato antes de editarlo.`);
    } finally {
      if (requestId === coachRequestId.current) setCoachUpdating(false);
    }
  }

  // ---------- 3) Guardar ----------
  async function save() {
    if (!plateName.trim()) {
      setError('Ponele un nombre al plato antes de guardarlo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      await appendImage(body, 'image', photo.uri);
      body.append('name', plateName.trim());
      body.append('source', photo.source);
      body.append('ingredients', JSON.stringify(analysis.ingredients.map(stripClientFields)));
      body.append('coachFeedback', JSON.stringify(analysis.coachFeedback));
      await api('/meals', { method: 'POST', body, timeout: 30000 });
      reset();
      await refreshData(); // racha, comidas de hoy y escaneos restantes
      router.navigate('/');
      if (showAds) showInterstitialIfReady();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(plateName.trim()) && !saving && !coachUpdating && !editing;

  // ================= Vista: resultados =================
  if (analysis && photo) {
    const t = analysis.totals;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <View style={styles.resultsHead}>
            <Pressable onPress={reset} style={styles.backBtn} hitSlop={8} accessibilityLabel="Escanear otro plato">
              <ArrowLeft size={20} color={colors.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultsTitle}>Resultado del análisis</Text>
              <Text style={styles.resultsSub}>Revisá lo que detectó la IA y guardá tu plato.</Text>
            </View>
          </View>

          {analysis.mocked ? (
            <Message>
              Modo simulado: el backend no tiene una GEMINI_API_KEY configurada, así que estos ingredientes son de ejemplo y no corresponden a tu foto.
            </Message>
          ) : null}
          {error ? <Message>{error}</Message> : null}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Plato analizado" />
            <View style={{ padding: 14, gap: 10 }}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Análisis completado</Text>
              </View>
              <MacroTotals calories={t.totalCalories} proteinG={t.totalProteinG} carbsG={t.totalCarbsG} fatG={t.totalFatG} />
            </View>
          </Card>

          <Card>
            <View style={styles.ingHead}>
              <Text style={styles.h3}>Ingredientes detectados</Text>
              {!editing ? (
                <Pressable onPress={startEditing} style={styles.editBtn}>
                  <Pencil size={13} color={colors.primary} />
                  <Text style={styles.editText}>Editar</Text>
                </Pressable>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
                    <X size={13} color={colors.inkSoft} />
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={applyEdits} disabled={lookupsPending} style={[styles.okBtn, lookupsPending && { opacity: 0.5 }]}>
                    <Text style={styles.okText}>{lookupsPending ? 'Recalculando…' : 'Listo'}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {editing ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.hint}>
                  Si la IA confundió un ingrediente, corregí el nombre: al terminar de escribir se recalculan sus calorías y macros.
                </Text>
                <IngredientEditor ingredients={draft} onChange={setDraft} />
              </View>
            ) : (
              analysis.ingredients.map((ing, i) => (
                <View key={ing._uid} style={[styles.ingRow, i === analysis.ingredients.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.ingTop}>
                    <Text style={styles.ingName} numberOfLines={2}>{ing.name}</Text>
                    <Text style={styles.ingGrams}>{Math.round(ing.grams)} g</Text>
                  </View>
                  <Text style={styles.ingMacros}>
                    <Text style={{ color: colors.primary }}>{Math.round(ing.calories)} kcal</Text>
                    {'  ·  '}<Text style={{ color: colors.protein }}>{Math.round(ing.proteinG)}g P</Text>
                    {'  ·  '}<Text style={{ color: colors.carbs }}>{Math.round(ing.carbsG)}g C</Text>
                    {'  ·  '}<Text style={{ color: colors.fats }}>{Math.round(ing.fatG)}g G</Text>
                  </Text>
                </View>
              ))
            )}
          </Card>

          <CoachCard
            feedback={analysis.coachFeedback}
            updating={coachUpdating}
            note={coachError || (analysis.coachMocked && !coachUpdating
              ? 'Devolución básica calculada con reglas simples: la IA no respondió en este momento.'
              : null)}
          />

          <Card style={{ gap: 10 }}>
            <Text style={styles.label}>Nombre del plato <Text style={{ color: colors.danger }}>*</Text></Text>
            <TextInput
              value={plateName}
              onChangeText={setPlateName}
              placeholder="Ej: Almuerzo fitness"
              placeholderTextColor={colors.inkMuted}
              maxLength={120}
              style={styles.nameInput}
            />
            <PrimaryButton label={saving ? 'Guardando…' : 'Agregar a comidas de hoy'} onPress={save} disabled={!canSave} />
            {editing ? <Text style={styles.hint}>Terminá de editar los ingredientes (Listo o Cancelar) antes de agregar el plato.</Text> : null}
            <Text style={styles.hint}>El plato recién se guarda en tu historial cuando le ponés un nombre y confirmás acá.</Text>
          </Card>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  // ================= Vista: elegir foto / analizando =================
  return (
    <Screen>
      <ScreenTitle title="Escáner IA" subtitle="Sacá una foto de tu plato y la IA calcula sus nutrientes." />

      {error ? <Message>{error}</Message> : null}

      <View style={styles.viewfinder}>
        {photo && analyzing ? (
          <>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.analyzingText}>Analizando con IA…</Text>
              <Text style={styles.analyzingSub}>Identificando ingredientes y porciones</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Badge label="Escaneo con IA" icon={<Sparkles size={12} color={colors.primaryDark} />} style={{ alignSelf: 'center', backgroundColor: colors.surface }} />
            <Text style={styles.vfText}>Tomá una foto de tu plato o elegí una de tu galería.</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Tomar foto" icon={<Camera size={18} color="#fff" />} style={{ flex: 1 }}
          disabled={analyzing || limitReached} onPress={() => pickImage('MOBILE_CAMERA')}
        />
        <PrimaryButton
          label="Galería" variant="ghost" icon={<ImagePlus size={18} color={colors.primary} />} style={{ flex: 1 }}
          disabled={analyzing || limitReached} onPress={() => pickImage('MOBILE_GALLERY')}
        />
      </View>

      <Card style={styles.quota}>
        <View style={{ flex: 1 }}>
          <Text style={styles.quotaTitle}>{isPremium ? 'Escaneos ilimitados' : 'Escaneos disponibles hoy'}</Text>
          <Text style={styles.quotaSub}>{isPremium ? 'Plan NutriVision Pro' : `Plan Gratuito · ${limit} por día`}</Text>
        </View>
        {!isPremium ? (
          <View style={[styles.quotaPill, limitReached && { backgroundColor: colors.dangerSoft }]}>
            <Text style={[styles.quotaNum, limitReached && { color: colors.danger }]}>{left}</Text>
            <Text style={styles.quotaOf}>/ {limit}</Text>
          </View>
        ) : null}
      </Card>

      {limitReached ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.quotaTitle}>Llegaste al límite de hoy</Text>
          <Text style={styles.quotaSub}>Mañana vas a tener {limit} escaneos nuevos, o podés pasarte a NutriVision Pro para escanear sin límite.</Text>
          <PrimaryButton label="Ver NutriVision Pro" icon={<Crown size={16} color="#fff" />} onPress={() => router.push('/premium')} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Consejos para una buena foto" />
        {TIPS.map((tip, i) => (
          <View key={tip} style={styles.tipRow}>
            <View style={styles.tipNum}><Text style={styles.tipNumText}>{i + 1}</Text></View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
        <View style={styles.tipFoot}>
          <Lightbulb size={14} color={colors.accent} />
          <Text style={styles.hint}>El análisis tarda unos segundos: la foto se envía a la IA y se cruza con FatSecret.</Text>
        </View>
      </Card>
    </Screen>
  );
}

/** Achica la foto (lado mayor 1280 px, JPEG) para que la subida sea rápida. */
async function shrink(asset) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const { width = 0, height = 0 } = asset;
  if (width > MAX_SIDE || height > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

const C = 26;
const styles = StyleSheet.create({
  viewfinder: {
    height: 300, borderRadius: radius.xl, backgroundColor: colors.primarySoft, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
  },
  logo: { width: 80, height: 116, opacity: 0.9 },
  vfText: { textAlign: 'center', color: colors.inkSoft, fontSize: 13, maxWidth: 240 },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.primary },
  tl: { top: 18, left: 18, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 18, right: 18, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 18, left: 18, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 18, right: 18, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  analyzingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,122,58,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  analyzingText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  analyzingSub: { color: '#fff', opacity: 0.85, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  quota: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quotaTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  quotaSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  quotaPill: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  quotaNum: { fontSize: 20, fontWeight: '800', color: colors.primary },
  quotaOf: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginLeft: 2 },
  tipRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, alignItems: 'flex-start' },
  tipNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tipNumText: { fontSize: 12, fontWeight: '800', color: '#8A6212' },
  tipText: { flex: 1, fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  tipFoot: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 6 },

  resultsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  resultsTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  resultsSub: { fontSize: 13, color: colors.inkSoft },
  photo: { width: '100%', height: 220, backgroundColor: colors.bg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statusText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  ingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  editText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.line },
  cancelText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  okBtn: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.primary },
  okText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ingRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 3 },
  ingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  ingName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  ingGrams: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  ingMacros: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17, flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  nameInput: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
});
