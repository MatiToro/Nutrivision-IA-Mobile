import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Search, Users, X } from 'lucide-react-native';
import { Card, EmptyState, PrimaryButton, Screen, ScreenTitle } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar } from '../../components/Nutritionist';
import { FilterChips, NUTRI_STATUS_LABELS, ROLE_LABELS, Tag, roleTone, statusTone } from '../../components/Admin';
import { api } from '../../api/client';
import { colors, radius } from '../../theme';

const FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'USER', label: 'Usuarios' },
  { value: 'NUTRITIONIST', label: 'Nutricionistas' },
  { value: 'PREMIUM', label: 'Pro' },
  { value: 'BANNED', label: 'Baneados' },
  { value: 'ADMIN', label: 'Admins' },
];

/** Gestión de usuarios: búsqueda, filtros y acceso al detalle. */
export default function AdminUsersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [result, setResult] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (q, f, page) => {
    const params = new URLSearchParams({ filter: f, page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    return api(`/admin/users?${params.toString()}`);
  }, []);

  const load = useCallback(async (q, f) => {
    try {
      setResult(await fetchPage(q, f, 1));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchPage]);

  // Al volver del detalle (ej. después de banear) se refresca la lista.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick((t) => t + 1); }, []));

  // Búsqueda con una pequeña espera para no pedir en cada letra.
  useEffect(() => {
    if (!focusTick) return undefined;
    const t = setTimeout(() => load(query, filter), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, filter, focusTick, load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await fetchPage(query, filter, result.page + 1);
      setResult((prev) => ({ ...next, users: [...prev.users, ...next.users] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen onRefresh={() => load(query, filter)}>
      <ScreenTitle title="Usuarios" subtitle={result ? `${result.total} ${result.total === 1 ? 'cuenta' : 'cuentas'}` : 'Todas las cuentas registradas'} />

      <View style={styles.search}>
        <Search size={18} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o correo"
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          maxLength={80}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda"><X size={16} color={colors.inkMuted} /></Pressable>
        ) : null}
      </View>
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {error ? <Message>{error}</Message> : null}

      {result === null ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
      ) : result.users.length === 0 ? (
        <Card><EmptyState icon={<Users size={24} color={colors.primary} />} title="Sin resultados" text="Probá con otra búsqueda o filtro." /></Card>
      ) : (
        <View style={{ gap: 8 }}>
          {result.users.map((u) => (
            <Pressable key={u.id} onPress={() => router.push(`/admin-usuario/${u.id}`)} style={({ pressed }) => [styles.row, u.banned && styles.rowBanned, pressed && { opacity: 0.85 }]}>
              <Avatar uri={u.photoUrl} name={u.name} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                <View style={styles.tags}>
                  <Tag label={ROLE_LABELS[u.role]} tone={roleTone(u.role)} />
                  {u.role === 'USER' ? <Tag label={u.isPremium ? (u.plan === 'PREMIUM' ? 'Pro' : 'Pro (código)') : 'Gratuito'} tone={u.isPremium ? 'gold' : 'gray'} /> : null}
                  {u.role === 'NUTRITIONIST' ? (
                    <Tag label={u.nutritionistStatus ? NUTRI_STATUS_LABELS[u.nutritionistStatus] : 'Sin solicitud'} tone={statusTone(u.nutritionistStatus)} />
                  ) : null}
                  {u.banned ? <Tag label="Baneado" tone="red" /> : null}
                </View>
              </View>
              <ChevronRight size={18} color={colors.inkMuted} />
            </Pressable>
          ))}
          {result.hasMore ? (
            <PrimaryButton variant="ghost" label={loadingMore ? 'Cargando…' : 'Cargar más'} onPress={loadMore} disabled={loadingMore} />
          ) : null}
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
  rowBanned: { backgroundColor: '#FDF3F2' },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  email: { fontSize: 12, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
});
