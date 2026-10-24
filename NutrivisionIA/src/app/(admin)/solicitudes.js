import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, ClipboardCheck, Search, X } from 'lucide-react-native';
import { Card, EmptyState, Screen, ScreenTitle } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar, RatingLine } from '../../components/Nutritionist';
import { FilterChips, Tag } from '../../components/Admin';
import { api } from '../../api/client';
import { colors, radius } from '../../theme';

const TABS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'REJECTED', label: 'Rechazados' },
];
const EMPTY = {
  PENDING: ['No hay solicitudes pendientes', 'Cuando un nutricionista envíe su matrícula, va a aparecer acá.'],
  APPROVED: ['Todavía no hay nutricionistas aprobados', 'Aprobá una solicitud pendiente para que aparezca acá.'],
  REJECTED: ['No hay solicitudes rechazadas', ''],
};
const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

/** Nutricionistas: solicitudes pendientes para aprobar o rechazar, aprobados y rechazados. */
export default function AdminNutritionistsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (st, q) => {
    try {
      const params = new URLSearchParams({ status: st });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/admin/nutritionists?${params.toString()}`);
      setList({ status: st, items: res.nutritionists });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick((t) => t + 1); }, []));
  useEffect(() => {
    if (!focusTick) return undefined;
    const t = setTimeout(() => load(status, query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [status, query, focusTick, load]);

  const items = list?.status === status ? list.items : null;

  return (
    <Screen onRefresh={() => load(status, query)}>
      <ScreenTitle title="Nutricionistas" subtitle="Verificá matrículas y gestioná profesionales." />

      <FilterChips options={TABS} value={status} onChange={setStatus} />
      <View style={styles.search}>
        <Search size={18} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre, correo o matrícula"
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          maxLength={80}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda"><X size={16} color={colors.inkMuted} /></Pressable>
        ) : null}
      </View>

      {error ? <Message>{error}</Message> : null}

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<ClipboardCheck size={24} color={colors.primary} />} title={EMPTY[status][0]} text={EMPTY[status][1]} /></Card>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((n) => (
            <Pressable key={n.id} onPress={() => router.push(`/admin-nutricionista/${n.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              <Avatar uri={n.photoUrl} name={n.name} size={46} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>{n.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>Matrícula {n.licenseNumber} · {n.email}</Text>
                {status === 'PENDING' ? (
                  <Text style={styles.meta}>Enviada el {fmtDate(n.updatedAt)}</Text>
                ) : status === 'APPROVED' ? (
                  <>
                    <RatingLine rating={n.rating} size={12} />
                    <View style={styles.tags}>
                      <Tag label={n.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={n.subscriptionActive ? 'green' : 'gray'} />
                      <Tag label={`${n.activePatients} ${n.activePatients === 1 ? 'paciente' : 'pacientes'}`} tone="blue" />
                      {n.banned ? <Tag label="Baneado" tone="red" /> : null}
                    </View>
                  </>
                ) : (
                  <Text style={styles.reason} numberOfLines={2}>Motivo: {n.rejectionReason}</Text>
                )}
              </View>
              <ChevronRight size={18} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft },
  reason: { fontSize: 12, color: colors.danger },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
});
