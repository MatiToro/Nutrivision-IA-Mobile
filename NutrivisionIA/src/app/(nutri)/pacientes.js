import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, KeyRound, RefreshCw, Share2, Users } from 'lucide-react-native';
import { Card, EmptyState, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar } from '../../components/Nutritionist';
import { useNutri } from '../../context/NutriContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { GOAL_OPTIONS, findOption } from '../../constants/profile';
import { colors, radius } from '../../theme';

const relative = (d) => {
  if (!d) return 'Todavía no registró comidas';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'Última comida: hoy';
  if (days === 1) return 'Última comida: ayer';
  return `Última comida: hace ${days} días`;
};

/** Pacientes vinculados y código de vinculación. */
export default function PatientsScreen() {
  const router = useRouter();
  const { profile: user } = useAuth();
  const { data, refresh, apply } = useNutri();
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const active = data?.subscription?.active;
  const linkCode = data?.profile?.linkCode;

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const res = await api(`/nutritionist/patients?todayFrom=${encodeURIComponent(start.toISOString())}`);
      setPatients(res.patients);
      setLocked(false);
      setError(null);
    } catch (err) {
      if (err.status === 403) {
        setLocked(true);
        setPatients([]);
      } else {
        setError(err.message);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refreshAll = async () => { await Promise.all([load(), refresh()]); };

  const shareCode = () => Share.share({
    message: `Vinculate conmigo en NutriVision IA: en la app andá a Perfil → Mi nutricionista e ingresá el código ${linkCode}. — ${user?.displayName || ''}`,
  }).catch(() => {});

  const regenerate = () => confirm({
    title: 'Generar código nuevo',
    message: 'El código actual deja de funcionar. Tus pacientes ya vinculados no se ven afectados.',
    confirmLabel: 'Generar',
    onConfirm: async () => {
      setRegenerating(true);
      try {
        apply(await api('/nutritionist/me/link-code', { method: 'POST' }));
      } catch (err) {
        setError(err.message);
      } finally {
        setRegenerating(false);
      }
    },
  });

  const firstName = (user?.displayName || '').replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ')[0];

  return (
    <Screen onRefresh={refreshAll}>
      <ScreenTitle title="Pacientes" subtitle={firstName ? `Hola, ${firstName}. Así vienen tus pacientes hoy.` : 'Así vienen tus pacientes hoy.'} />

      {!active ? (
        <Pressable onPress={() => router.push('/suscripcion')}>
          <Card style={styles.warn}>
            <AlertTriangle size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Tu suscripción no está activa</Text>
              <Text style={styles.warnText}>No aparecés en el directorio y no podés ver las fichas. Tus vínculos se conservan.</Text>
            </View>
            <ChevronRight size={18} color={colors.inkMuted} />
          </Card>
        </Pressable>
      ) : null}

      {/* Código de vinculación */}
      <Card style={styles.codeCard}>
        <View style={styles.codeHead}>
          <KeyRound size={18} color={colors.primary} />
          <Text style={styles.codeTitle}>Tu código de vinculación</Text>
        </View>
        <Text style={styles.code} selectable>{linkCode || '—'}</Text>
        <Text style={styles.codeHint}>
          Tus pacientes lo ingresan en Perfil → Mi nutricionista y aceptan compartir su información con vos.
        </Text>
        <View style={styles.codeActions}>
          <Pressable onPress={shareCode} style={styles.codeBtn}>
            <Share2 size={16} color="#fff" />
            <Text style={styles.codeBtnText}>Compartir</Text>
          </Pressable>
          <Pressable onPress={regenerate} disabled={regenerating} style={[styles.codeBtnGhost, regenerating && { opacity: 0.6 }]}>
            <RefreshCw size={16} color={colors.primary} />
            <Text style={styles.codeBtnGhostText}>{regenerating ? 'Generando…' : 'Nuevo código'}</Text>
          </Pressable>
        </View>
      </Card>

      {error ? <Message>{error}</Message> : null}

      <View style={{ gap: 10 }}>
        <SectionHeader title={`Pacientes activos${data?.stats ? ` (${data.stats.activePatients})` : ''}`} />
        {patients === null ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : locked ? (
          <Card>
            <EmptyState
              icon={<Users size={24} color={colors.primary} />}
              title="Fichas bloqueadas"
              text="Activá tu suscripción para ver el progreso de tus pacientes."
            />
          </Card>
        ) : patients.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users size={24} color={colors.primary} />}
              title="Todavía no tenés pacientes"
              text="Compartí tu código de vinculación para que tus pacientes se sumen."
            />
          </Card>
        ) : (
          patients.map((p) => <PatientRow key={p.id} p={p} onPress={() => router.push(`/nutri-paciente/${p.id}`)} />)
        )}
      </View>
    </Screen>
  );
}

function PatientRow({ p, onPress }) {
  const goal = findOption(GOAL_OPTIONS, p.goal);
  const pct = p.today.calorieGoal ? Math.min(p.today.calories / p.today.calorieGoal, 1) : 0;
  const over = p.today.calorieGoal && p.today.calories > p.today.calorieGoal * 1.1;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <Avatar uri={p.photoUrl} name={p.name} size={48} />
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{goal?.label || 'Sin objetivo'}{p.weightKg ? ` · ${String(p.weightKg).replace('.', ',')} kg` : ''}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }, over && { backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.meta}>
          Hoy: <Text style={styles.metaStrong}>{p.today.calories}</Text>{p.today.calorieGoal ? ` / ${p.today.calorieGoal}` : ''} kcal · {relative(p.lastMealAt)}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  warn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.accentSoft },
  warnTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  warnText: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  codeCard: { gap: 10 },
  codeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  code: {
    fontSize: 30, fontWeight: '800', letterSpacing: 5, color: colors.primaryDark, textAlign: 'center',
    backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 12,
  },
  codeHint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  codeActions: { flexDirection: 'row', gap: 10 },
  codeBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11 },
  codeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  codeBtnGhost: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: 10 },
  codeBtnGhostText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft },
  metaStrong: { fontWeight: '800', color: colors.ink },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
});
