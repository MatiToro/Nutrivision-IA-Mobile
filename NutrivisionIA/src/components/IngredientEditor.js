import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, RotateCcw, Trash2 } from 'lucide-react-native';
import { api } from '../api/client';
import { newUid, refreshBasis, round1, scaleFromBasis } from '../utils/ingredients';
import { colors, radius } from '../theme';

const EMPTY_INGREDIENT = { name: '', grams: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const MANUAL_FIELDS = [
  { field: 'calories', label: 'kcal', color: colors.primary },
  { field: 'proteinG', label: 'Prot', color: colors.protein },
  { field: 'carbsG', label: 'Carbs', color: colors.carbs },
  { field: 'fatG', label: 'Grasas', color: colors.fats },
];
const toNum = (t) => Math.max(0, Number(String(t).replace(',', '.')) || 0);

/**
 * Ajuste manual de ingredientes (misma lógica que la Web):
 * - Ingredientes de la IA: se edita nombre y gramos. Los macros se escalan solos
 *   desde la referencia (_basis). Si cambia el nombre, al terminar de escribir se
 *   piden los macros nuevos a la IA (POST /meals/ingredient-nutrition).
 * - Ingredientes agregados a mano: se cargan calorías y macros directamente.
 */
export default function IngredientEditor({ ingredients, onChange }) {
  const updateByUid = (uid, updater) => onChange((prev) => prev.map((i) => (i._uid === uid ? updater(i) : i)));

  const updateName = (uid, value) => updateByUid(uid, (ing) => ({
    ...ing,
    name: value,
    source: ing.source || 'MANUAL_EDITED',
    ...(value.trim() === ing._refName ? { _lookup: undefined, _lookupError: undefined } : {}),
  }));

  const updateGrams = (uid, text) => {
    const grams = toNum(text);
    updateByUid(uid, (ing) => ({ ...ing, grams, ...scaleFromBasis(ing._basis, grams), source: ing.source || 'MANUAL_EDITED' }));
  };

  const updateManual = (uid, field, text) => updateByUid(uid, (ing) => refreshBasis({ ...ing, [field]: toNum(text) }));

  async function recalculateByName(uid) {
    const ing = ingredients.find((i) => i._uid === uid);
    if (!ing || ing.source === 'MANUAL_ADDED') return;
    const requestedName = ing.name.trim();
    if (requestedName.length < 2 || requestedName === ing._refName) return;

    updateByUid(uid, (i) => ({ ...i, _lookup: 'pending', _lookupError: undefined }));
    try {
      const data = await api('/meals/ingredient-nutrition', {
        method: 'POST',
        body: { name: requestedName, grams: Number(ing.grams) || 0 },
        timeout: 45000,
      });
      const ref = data.ingredient;
      updateByUid(uid, (i) => {
        if (i.name.trim() !== requestedName) return { ...i, _lookup: undefined }; // respuesta vieja
        const basis = { grams: ref.grams, calories: ref.calories, proteinG: ref.proteinG, carbsG: ref.carbsG, fatG: ref.fatG };
        const scaled = scaleFromBasis(basis, i.grams) || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
        return {
          ...i, ...scaled, _basis: basis, _refName: requestedName, _lookup: undefined, _lookupError: undefined,
          source: 'MANUAL_EDITED', fatSecretFoodId: ref.fatSecretFoodId || null,
        };
      });
    } catch (err) {
      updateByUid(uid, (i) => (i.name.trim() === requestedName
        ? { ...i, _lookup: 'error', _lookupError: err.message }
        : { ...i, _lookup: undefined }));
    }
  }

  const remove = (uid) => onChange((prev) => prev.filter((i) => i._uid !== uid));
  const add = () => onChange((prev) => [...prev, { ...EMPTY_INGREDIENT, source: 'MANUAL_ADDED', _uid: newUid(), _basis: null, _refName: '' }]);

  return (
    <View style={{ gap: 10 }}>
      {ingredients.map((ing) => {
        const manual = ing.source === 'MANUAL_ADDED';
        const pending = ing._lookup === 'pending';
        return (
          <View key={ing._uid} style={styles.card}>
            <View style={styles.row}>
              <TextInput
                value={ing.name}
                onChangeText={(t) => updateName(ing._uid, t)}
                onBlur={() => recalculateByName(ing._uid)}
                placeholder={manual ? 'Nombre del ingrediente' : 'Ingrediente'}
                placeholderTextColor={colors.inkMuted}
                style={[styles.input, { flex: 1 }]}
                maxLength={120}
                returnKeyType="done"
                accessibilityLabel="Nombre del ingrediente"
              />
              <View style={[styles.gramsWrap, pending && { opacity: 0.5 }]}>
                <TextInput
                  value={String(ing.grams ?? '')}
                  onChangeText={(t) => updateGrams(ing._uid, t)}
                  keyboardType="decimal-pad"
                  editable={!pending}
                  style={styles.gramsInput}
                  maxLength={5}
                  selectTextOnFocus
                  accessibilityLabel="Cantidad en gramos"
                />
                <Text style={styles.unit}>g</Text>
              </View>
              <Pressable onPress={() => remove(ing._uid)} disabled={pending} hitSlop={8} style={[styles.del, pending && { opacity: 0.4 }]} accessibilityLabel={`Eliminar ${ing.name || 'ingrediente'}`}>
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            </View>

            {manual ? (
              <View style={styles.manualRow}>
                {MANUAL_FIELDS.map(({ field, label, color }) => (
                  <View key={field} style={styles.manualCell}>
                    <TextInput
                      value={String(ing[field] ?? '')}
                      onChangeText={(t) => updateManual(ing._uid, field, t)}
                      keyboardType="decimal-pad"
                      style={styles.manualInput}
                      maxLength={6}
                      selectTextOnFocus
                      accessibilityLabel={label}
                    />
                    <Text style={[styles.manualLabel, { color }]}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : pending ? (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusText}>Recalculando con IA…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.macros}>
                  <Text style={{ color: colors.primary }}>{Math.round(ing.calories)} kcal</Text>
                  {'  ·  '}<Text style={{ color: colors.protein }}>{round1(ing.proteinG)}g P</Text>
                  {'  ·  '}<Text style={{ color: colors.carbs }}>{round1(ing.carbsG)}g C</Text>
                  {'  ·  '}<Text style={{ color: colors.fats }}>{round1(ing.fatG)}g G</Text>
                </Text>
                {ing._lookup === 'error' ? (
                  <View style={styles.errorRow}>
                    <Text style={styles.errorText}>{ing._lookupError} Se mantienen los valores anteriores.</Text>
                    <Pressable onPress={() => recalculateByName(ing._uid)} hitSlop={6} style={styles.retry}>
                      <RotateCcw size={12} color={colors.primary} />
                      <Text style={styles.retryText}>Reintentar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
      })}

      <Pressable onPress={add} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}>
        <Plus size={16} color={colors.primary} />
        <Text style={styles.addText}>Agregar ingrediente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: 10, gap: 8, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.ink, minWidth: 0 },
  gramsWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 8, width: 78 },
  gramsInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  unit: { fontSize: 12, color: colors.inkSoft, marginLeft: 3 },
  del: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  macros: { fontSize: 12, fontWeight: '700' },
  manualRow: { flexDirection: 'row', gap: 6 },
  manualCell: { flex: 1, alignItems: 'center', gap: 2 },
  manualInput: { width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, fontSize: 13, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  manualLabel: { fontSize: 10, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 12, color: colors.inkSoft },
  errorRow: { gap: 4 },
  errorText: { fontSize: 12, color: colors.danger },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  retryText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
});
