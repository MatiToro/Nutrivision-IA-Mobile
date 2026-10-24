import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, Search, Stethoscope, X } from 'lucide-react-native';
import { Card, EmptyState, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { BackHeader, NutritionistCard } from '../../components/Nutritionist';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { colors, radius } from '../../theme';

/** Directorio de nutricionistas aprobados y con suscripción vigente. */
export default function NutritionistsScreen() {
  const router = useRouter();
  const { myLink } = useApp();
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [list, setList] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async (q, spec) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (spec) params.set('specialty', spec);
      const qs = params.toString();
      const data = await api(`/nutritionists${qs ? `?${qs}` : ''}`);
      setList(data.nutritionists ?? []);
      setSpecialties(data.specialties ?? []);
    } catch (err) {
      setError(err.message);
      setList((prev) => prev ?? []);
    }
  }, []);

  // Búsqueda con una pequeña espera para no pedir en cada letra.
  useEffect(() => {
    const t = setTimeout(() => load(query, specialty), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, specialty, load]);

  const linkedId = myLink?.nutritionist?.id;

  return (
    <Screen onRefresh={() => load(query, specialty)}>
      <BackHeader title="Nutricionistas" />

      <Text style={styles.intro}>
        Profesionales con matrícula verificada. Vinculate con uno para que siga tu progreso y te ayude con tus metas.
      </Text>

      {/* Tengo un código */}
      <Pressable onPress={() => router.push('/mi-nutricionista')} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <Card style={styles.codeCard}>
          <View style={styles.codeIcon}><KeyRound size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.codeTitle}>{linkedId ? 'Mi nutricionista' : '¿Tu nutricionista te pasó un código?'}</Text>
            <Text style={styles.codeText}>{linkedId ? `Estás vinculado con ${myLink.nutritionist.name}.` : 'Ingresalo para vincularte.'}</Text>
          </View>
        </Card>
      </Pressable>

      <View style={styles.search}>
        <Search size={18} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre o tema"
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          returnKeyType="search"
          maxLength={60}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
            <X size={16} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      {specialties.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {['', ...specialties].map((s) => {
            const active = specialty === s;
            return (
              <Pressable key={s || 'all'} onPress={() => setSpecialty(s)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s || 'Todas'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {error ? <Message>{error}</Message> : null}

      <View style={{ gap: 10 }}>
        <SectionHeader title={list ? `${list.length} ${list.length === 1 ? 'profesional' : 'profesionales'}` : 'Profesionales'} />
        {list === null ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 30 }} />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Stethoscope size={24} color={colors.primary} />}
              title={query || specialty ? 'Sin resultados' : 'Todavía no hay nutricionistas'}
              text={query || specialty ? 'Probá con otra búsqueda o especialidad.' : 'Pronto vas a encontrar profesionales disponibles acá.'}
            />
          </Card>
        ) : (
          list.map((n) => (
            <NutritionistCard key={n.id} n={n} highlight={n.id === linkedId} onPress={() => router.push(`/nutricionistas/${n.id}`)} />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft },
  codeIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  codeText: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 15, color: colors.ink },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTextActive: { color: '#fff' },
});
