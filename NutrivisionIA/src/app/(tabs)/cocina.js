import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check, ChefHat, Crown, Lock, Pencil, Plus, Refrigerator, ShoppingCart, Sparkles, Trash2, WifiOff, X } from 'lucide-react-native';
import { Badge, Card, EmptyState, PrimaryButton, Screen, ScreenTitle } from '../../components/ui';
import ItemFormModal from '../../components/ItemFormModal';
import RecipesPanel from '../../components/Recipes';
import { useApp } from '../../context/AppContext';
import { colors, radius, shadow } from '../../theme';
import { confirm } from '../../utils/confirm';
import { Message } from '../../components/AuthUI';
import { api } from '../../api/client';

const SECTIONS = [
  { key: 'heladera', label: 'Heladera', icon: Refrigerator },
  { key: 'compras', label: 'Compras', icon: ShoppingCart },
  { key: 'recetas', label: 'Recetas', icon: ChefHat },
];

// Definidos fuera del componente para que el modal no se reinicie en cada render.
const FRIDGE_FIELDS = [
  { key: 'name', label: 'Alimento', placeholder: 'Ej: Huevos', required: true },
  { key: 'quantity', label: 'Cantidad', placeholder: 'Ej: 6 unidades, 500 g, 1 L', maxLength: 30 },
];
const SHOPPING_FIELDS = [
  { key: 'name', label: 'Producto', placeholder: 'Ej: Tomates', required: true },
  { key: 'quantity', label: 'Cantidad', placeholder: 'Ej: 2, 1 kg (vacío = 1)', maxLength: 30 },
];

/** "2" → "×2"; "1 kg" se muestra tal cual. Productos viejos sin cantidad cuentan como 1. */
const formatQty = (q) => {
  const t = String(q || '').trim() || '1';
  return /^\d+([.,]\d+)?$/.test(t) ? `×${t}` : t;
};

export default function KitchenScreen() {
  const params = useLocalSearchParams();
  const { refreshKitchen } = useApp();
  const [section, setSection] = useState('heladera');
  const [lastParam, setLastParam] = useState(null);

  if (params.seccion !== lastParam) {
    setLastParam(params.seccion);
    if (SECTIONS.some((s) => s.key === params.seccion)) setSection(params.seccion);
  }

  return (
    <Screen onRefresh={refreshKitchen}>
      <ScreenTitle title="Mi cocina" subtitle="Tu heladera, tu lista de compras y recetas con IA." />

      <View style={styles.segment}>
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const active = section === key;
          return (
            <Pressable key={key} onPress={() => setSection(key)} style={[styles.segBtn, active && styles.segBtnActive]}>
              <Icon size={16} color={active ? '#fff' : colors.inkSoft} />
              <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {section !== 'recetas' ? <KitchenSync /> : null}
      {section === 'heladera' && <KitchenGate><FridgeSection /></KitchenGate>}
      {section === 'compras' && <KitchenGate><ShoppingSection onGoToFridge={() => setSection('heladera')} /></KitchenGate>}
      {section === 'recetas' && <KitchenGate><RecipesSection onGoToFridge={() => setSection('heladera')} /></KitchenGate>}
    </Screen>
  );
}

/* ---------------- Sincronización con el servidor ---------------- */

/** Mientras se carga la cocina por primera vez (o si no se pudo cargar) no se muestran las listas. */
function KitchenGate({ children }) {
  const { kitchenStatus, refreshKitchen } = useApp();
  if (kitchenStatus === 'ready') return children;
  if (kitchenStatus === 'error') {
    return (
      <Card>
        <EmptyState
          icon={<WifiOff size={24} color={colors.danger} />}
          title="No pudimos cargar tu cocina"
          text="Tu heladera y tu lista de compras se guardan en tu cuenta. Revisá la conexión y probá de nuevo."
        >
          <PrimaryButton label="Reintentar" onPress={refreshKitchen} style={{ marginTop: 14, alignSelf: 'stretch' }} />
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>Cargando tu cocina…</Text>
    </Card>
  );
}

/** Aviso cuando un cambio no se pudo guardar (la lista ya se recargó con lo guardado). */
function KitchenSync() {
  const { kitchenStatus, kitchenError, refreshKitchen } = useApp();
  if (kitchenStatus !== 'ready' || !kitchenError) return null;
  return (
    <Card style={styles.notice}>
      <WifiOff size={20} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeTitle}>No se pudo guardar el último cambio</Text>
        <Text style={styles.noticeText}>{kitchenError}</Text>
      </View>
      <Pressable onPress={refreshKitchen} hitSlop={8}>
        <Text style={styles.noticeAction}>Reintentar</Text>
      </Pressable>
    </Card>
  );
}

/* ---------------- Heladera ---------------- */
function FridgeSection() {
  const { fridge, addFridgeItem, updateFridgeItem, removeFridgeItem, kitchenNotice } = useApp();
  const [modal, setModal] = useState({ open: false, item: null });

  const onDelete = (item) =>
    confirm({
      title: 'Eliminar alimento',
      message: `¿Querés sacar "${item.name}" de tu heladera?`,
      onConfirm: () => removeFridgeItem(item.id),
    });

  return (
    <>
      <View style={styles.rowBetween}>
        <Text style={styles.count}>{fridge.length} {fridge.length === 1 ? 'alimento' : 'alimentos'}</Text>
        <Pressable onPress={() => setModal({ open: true, item: null })} style={styles.addBtn}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Agregar</Text>
        </Pressable>
      </View>

      {kitchenNotice ? <Message tone="info">{kitchenNotice}</Message> : null}

      <Card style={{ paddingVertical: 6 }}>
        {fridge.length === 0 ? (
          <EmptyState
            icon={<Refrigerator size={24} color={colors.primary} />}
            title="Tu heladera está vacía"
            text="Agregá los alimentos que tenés en casa para llevar el control y, con Premium, recibir recetas."
          />
        ) : (
          fridge.map((item, i) => (
            <View key={item.id} style={[styles.itemRow, i === fridge.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.itemIcon}><Text style={styles.itemInitial}>{item.name.charAt(0).toUpperCase()}</Text></View>
              <Text style={[styles.itemName, { flex: 1 }]}>{item.name}</Text>
              {item.quantity ? (
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyPillText}>{formatQty(item.quantity)}</Text>
                </View>
              ) : null}
              <Pressable onPress={() => setModal({ open: true, item })} hitSlop={8} style={styles.iconBtn} accessibilityLabel={`Editar ${item.name}`}>
                <Pencil size={16} color={colors.inkSoft} />
              </Pressable>
              <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.iconBtn} accessibilityLabel={`Eliminar ${item.name}`}>
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <ItemFormModal
        visible={modal.open}
        title={modal.item ? 'Editar alimento' : 'Agregar a la heladera'}
        fields={FRIDGE_FIELDS}
        initial={modal.item}
        submitLabel={modal.item ? 'Guardar cambios' : 'Agregar'}
        onClose={() => setModal({ open: false, item: null })}
        onSubmit={(v) => (modal.item ? updateFridgeItem(modal.item.id, v) : addFridgeItem(v))}
      />
    </>
  );
}

/* ---------------- Lista de compras ---------------- */
function ShoppingSection({ onGoToFridge }) {
  const { shopping, addShoppingItem, updateShoppingItem, toggleShoppingItem, removeShoppingItem, clearBoughtItems } = useApp();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveMsg, setMoveMsg] = useState(null);
  const [draft, setDraft] = useState('');
  const [qty, setQty] = useState('');
  const [editing, setEditing] = useState(null);

  const pending = shopping.filter((i) => !i.done);
  const bought = shopping.filter((i) => i.done);

  const quickAdd = () => {
    const name = draft.trim();
    if (!name) return;
    // Sin cantidad escrita, se asume 1
    addShoppingItem({ name, quantity: qty.trim() || '1' });
    setDraft('');
    setQty('');
  };

  const renderItem = (item, last) => (
    <View key={item.id} style={[styles.itemRow, last && { borderBottomWidth: 0 }]}>
      <Pressable
        onPress={() => toggleShoppingItem(item.id)}
        hitSlop={8}
        style={[styles.check, item.done && styles.checkDone]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.name}
      >
        {item.done ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </Pressable>
      <Text style={[styles.itemName, { flex: 1 }, item.done && styles.itemDone]}>{item.name}</Text>
      <View style={[styles.qtyPill, item.done && { opacity: 0.5 }]}>
        <Text style={styles.qtyPillText}>{formatQty(item.quantity)}</Text>
      </View>
      <Pressable onPress={() => setEditing(item)} hitSlop={8} style={styles.iconBtn} accessibilityLabel={`Editar ${item.name}`}>
        <Pencil size={16} color={colors.inkSoft} />
      </Pressable>
      <Pressable onPress={() => removeShoppingItem(item.id)} hitSlop={8} style={styles.iconBtn} accessibilityLabel={`Eliminar ${item.name}`}>
        <Trash2 size={16} color={colors.danger} />
      </Pressable>
    </View>
  );

  return (
    <>
      <View style={styles.quickAdd}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Agregar un producto…"
          placeholderTextColor={colors.inkMuted}
          style={styles.quickInput}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          maxLength={60}
        />
        <TextInput
          value={qty}
          onChangeText={setQty}
          placeholder="Cant."
          placeholderTextColor={colors.inkMuted}
          style={[styles.quickInput, styles.qtyInput]}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          maxLength={12}
          accessibilityLabel="Cantidad (si la dejás vacía es 1)"
        />
        <Pressable onPress={quickAdd} style={[styles.quickBtn, !draft.trim() && { opacity: 0.5 }]} disabled={!draft.trim()} accessibilityLabel="Agregar producto">
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      <Card style={{ paddingVertical: 6 }}>
        {shopping.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} color={colors.primary} />}
            title="Tu lista está vacía"
            text="Escribí lo que necesitás comprar y tachalo cuando lo tengas."
          />
        ) : (
          <>
            {pending.map((it, i) => renderItem(it, i === pending.length - 1 && bought.length === 0))}
            {bought.length > 0 ? (
              <View style={styles.boughtHeader}>
                <Text style={styles.boughtTitle}>Comprados ({bought.length})</Text>
                <Pressable onPress={clearBoughtItems} hitSlop={8}>
                  <Text style={styles.clear}>Limpiar</Text>
                </Pressable>
              </View>
            ) : null}
            {bought.map((it, i) => renderItem(it, i === bought.length - 1))}
          </>
        )}
      </Card>

      {bought.length > 0 ? (
        <PrimaryButton
          label={`Agregar comprados a la heladera (${bought.length})`}
          icon={<Refrigerator size={18} color="#fff" />}
          onPress={() => { setMoveMsg(null); setMoveOpen(true); }}
        />
      ) : null}

      {moveMsg ? (
        <View style={{ gap: 6 }}>
          <Message tone="info">{moveMsg}</Message>
          <Pressable onPress={onGoToFridge} hitSlop={6} style={styles.linkRow}>
            <Text style={styles.clear}>Ver mi heladera</Text>
            <ArrowRight size={14} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}

      <MoveToFridgeModal
        visible={moveOpen}
        items={bought}
        onClose={() => setMoveOpen(false)}
        onDone={(msg) => { setMoveOpen(false); setMoveMsg(msg); }}
      />

      <ItemFormModal
        visible={!!editing}
        title="Editar producto"
        fields={SHOPPING_FIELDS}
        initial={editing}
        submitLabel="Guardar cambios"
        onClose={() => setEditing(null)}
        onSubmit={(v) => updateShoppingItem(editing.id, { ...v, quantity: v.quantity || '1' })}
      />
    </>
  );
}

/* ---------------- Comprados → heladera ---------------- */

/** Elegir qué comprados van a la heladera (se destilda lo que no es comida, ej. desodorante). */
function MoveToFridgeModal({ visible, items, onClose, onDone }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        {/* Se monta de nuevo cada vez que se abre: arranca con todos marcados */}
        {visible ? <MoveToFridgeForm items={items} onClose={onClose} onDone={onDone} /> : null}
      </View>
    </Modal>
  );
}

function MoveToFridgeForm({ items, onClose, onDone }) {
  const { setKitchenData } = useApp();
  const [selected, setSelected] = useState(() => new Set(items.map((i) => i.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const confirmMove = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await api('/kitchen/shopping-bought/to-fridge', { method: 'POST', body: { ids: [...selected] } });
      setKitchenData(data);
      const parts = [];
      if (data.created) parts.push(data.created === 1 ? 'Se agregó 1 alimento a tu heladera' : `Se agregaron ${data.created} alimentos a tu heladera`);
      if (data.merged) parts.push(data.merged === 1 ? '1 ya estaba y se sumó la cantidad' : `${data.merged} ya estaban y se sumaron las cantidades`);
      onDone(`${parts.join(' y ')}.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const count = selected.size;
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Pasar a la heladera</Text>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <X size={18} color={colors.inkSoft} />
        </Pressable>
      </View>
      <Text style={styles.sheetHint}>Destildá lo que no va a la heladera (por ejemplo, artículos de limpieza). Lo que pase se saca de la lista.</Text>

      <ScrollView style={styles.sheetList}>
        {items.map((it, i) => {
          const on = selected.has(it.id);
          return (
            <Pressable
              key={it.id}
              onPress={() => toggle(it.id)}
              style={[styles.itemRow, i === items.length - 1 && { borderBottomWidth: 0 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={it.name}
            >
              <View style={[styles.check, on && styles.checkDone]}>
                {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text style={[styles.itemName, { flex: 1 }, !on && { color: colors.inkMuted }]}>{it.name}</Text>
              <View style={[styles.qtyPill, !on && { opacity: 0.5 }]}>
                <Text style={styles.qtyPillText}>{formatQty(it.quantity)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Message>{error}</Message> : null}
      <PrimaryButton
        label={saving ? 'Pasando…' : count ? `Agregar ${count} a la heladera` : 'Elegí al menos uno'}
        icon={saving ? <ActivityIndicator color="#fff" size="small" /> : <Refrigerator size={18} color="#fff" />}
        onPress={confirmMove}
        disabled={saving || count === 0}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

/* ---------------- Recetas inteligentes (Premium) ---------------- */
function RecipesSection({ onGoToFridge }) {
  const router = useRouter();
  const { isPremium } = useApp();

  if (!isPremium) {
    return (
      <LinearGradient colors={['#FFFBF0', '#FBF0D9']} style={styles.lockCard}>
        <View style={styles.lockIcon}><Lock size={26} color={colors.accent} /></View>
        <Badge label="Función Premium" tone="accent" icon={<Crown size={12} color="#8A6212" />} style={{ alignSelf: 'center' }} />
        <Text style={styles.lockTitle}>Recetas con lo que tenés en tu heladera</Text>
        <Text style={styles.lockText}>
          La IA te sugiere recetas con tus ingredientes y pasa los que te faltan a tu lista de compras con un solo toque.
        </Text>
        <PrimaryButton label="Conocer NutriVision Pro" icon={<Sparkles size={16} color="#fff" />} onPress={() => router.push('/premium')} style={{ alignSelf: 'stretch' }} />
      </LinearGradient>
    );
  }

  return <RecipesPanel onGoToFridge={onGoToFridge} />;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, ...shadow.card },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  segTextActive: { color: '#fff' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  itemInitial: { fontWeight: '800', color: colors.primary, fontSize: 16 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  itemDone: { textDecorationLine: 'line-through', color: colors.inkMuted },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  quickAdd: { flexDirection: 'row', gap: 8 },
  quickInput: {
    flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: colors.ink, borderWidth: 1.5, borderColor: colors.line,
  },
  qtyInput: { flexGrow: 0, flexShrink: 0, flexBasis: 80, width: 80, paddingHorizontal: 8, textAlign: 'center' },
  qtyPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, minWidth: 34, alignItems: 'center' },
  qtyPillText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  quickBtn: { width: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.primary },
  boughtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  boughtTitle: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  clear: { fontSize: 13, fontWeight: '700', color: colors.primary },

  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 },
  loadingText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.dangerSoft },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  noticeText: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  noticeAction: { fontSize: 13, fontWeight: '800', color: colors.primary },

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 6, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 6 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sheetHint: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  sheetList: { flexShrink: 1 },

  lockCard: { borderRadius: radius.lg, padding: 22, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#F3E2B8' },
  lockIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  lockTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  lockText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 19, marginBottom: 6 },
});

