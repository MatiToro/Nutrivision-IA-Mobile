import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ban, ChevronRight, ClipboardList, Crown, Link2, LogOut, ShieldCheck, Stethoscope, UserRound, Utensils } from 'lucide-react-native';
import { Card, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { colors, radius } from '../../theme';

/** Resumen del panel de Administrador: números reales de la base. */
export default function AdminSummaryScreen() {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setStats(await api('/admin/stats'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLogout = () => confirm({
    title: 'Cerrar sesión',
    message: '¿Querés cerrar la sesión de administrador en este teléfono?',
    confirmLabel: 'Cerrar sesión',
    onConfirm: () => { logout(); },
  });

  const pending = stats?.nutritionists.pending ?? 0;

  return (
    <Screen onRefresh={load}>
      <ScreenTitle
        title="Administración"
        subtitle={profile?.email}
        right={(
          <Pressable onPress={onLogout} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Cerrar sesión">
            <LogOut size={18} color={colors.inkSoft} />
          </Pressable>
        )}
      />

      {error ? <Message>{error}</Message> : null}
      {!stats && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {stats ? (
        <>
          {/* Solicitudes pendientes */}
          <Pressable onPress={() => router.push('/solicitudes')} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
            <Card style={[styles.pending, pending > 0 && styles.pendingOn]}>
              <View style={[styles.pendingIcon, pending > 0 && { backgroundColor: colors.surface }]}>
                <ClipboardList size={22} color={pending > 0 ? colors.accent : colors.inkMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>
                  {pending > 0 ? `${pending} ${pending === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}` : 'Sin solicitudes pendientes'}
                </Text>
                <Text style={styles.pendingText}>Nutricionistas esperando la verificación de su matrícula.</Text>
              </View>
              <ChevronRight size={18} color={colors.inkMuted} />
            </Card>
          </Pressable>

          <View>
            <SectionHeader title="Cuentas" />
            <View style={styles.grid}>
              <Stat Icon={UserRound} tone={colors.water} label="Usuarios" value={stats.users.USER} />
              <Stat Icon={Stethoscope} tone={colors.fiber} label="Nutricionistas" value={stats.users.NUTRITIONIST} />
              <Stat Icon={ShieldCheck} tone={colors.inkSoft} label="Administradores" value={stats.users.ADMIN} />
              <Stat Icon={Ban} tone={colors.danger} label="Baneados" value={stats.users.banned} />
            </View>
          </View>

          <View>
            <SectionHeader title="Actividad" />
            <View style={styles.grid}>
              <Stat Icon={Crown} tone={colors.accent} label="Pro pagos" value={stats.premium.paid} />
              <Stat Icon={Crown} tone={colors.accent} label="Pro por código" value={stats.premium.byCode} />
              <Stat Icon={Stethoscope} tone={colors.primary} label="Nutris aprobados" value={stats.nutritionists.approved} hint={`${stats.nutritionists.activeSubscriptions} con suscripción`} />
              <Stat Icon={Link2} tone={colors.primary} label="Vínculos activos" value={stats.activeLinks} />
              <Stat Icon={Utensils} tone={colors.primary} label="Platos hoy" value={stats.mealsToday} />
            </View>
          </View>

          <Text style={styles.note}>Las suscripciones Pro y de nutricionistas se cobran con Mercado Pago (débito automático).</Text>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ Icon, tone, label, value, hint }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${tone}1A` }]}><Icon size={16} color={tone} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendingOn: { backgroundColor: colors.accentSoft },
  pendingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  pendingText: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  statHint: { fontSize: 11, color: colors.inkMuted },
  note: { fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
});
