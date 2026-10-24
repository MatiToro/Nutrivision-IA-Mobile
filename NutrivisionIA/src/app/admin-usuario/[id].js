import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, ChevronRight, ShieldCheck, UserCheck } from 'lucide-react-native';
import { Card, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar, BackHeader } from '../../components/Nutritionist';
import { NUTRI_STATUS_LABELS, ROLE_LABELS, Segmented, Tag, roleTone, statusTone } from '../../components/Admin';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { GOAL_OPTIONS, findOption } from '../../constants/profile';
import { colors, radius } from '../../theme';

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuario' },
  { value: 'NUTRITIONIST', label: 'Nutricionista' },
  { value: 'ADMIN', label: 'Admin' },
];
const PLAN_OPTIONS = [
  { value: 'FREE', label: 'Gratuito' },
  { value: 'PREMIUM', label: 'NutriVision Pro' },
];
const ROLE_EFFECTS = {
  USER: 'Va a usar la app como paciente (escáner, cocina, nutricionistas).',
  NUTRITIONIST: 'Va a usar la app de nutricionista. Si no tiene solicitud, se le va a pedir que la complete.',
  ADMIN: 'Va a tener acceso completo a este panel de administración.',
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Detalle de un usuario: cambiar rol o plan, banear o desbanear. */
export default function AdminUserScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/admin/users/${id}`);
      setUser(res.user);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    // load es asíncrona: el estado se actualiza al llegar la respuesta.
    load();
  }, [load]);

  async function patch(body, okMsg) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api(`/admin/users/${id}`, { method: 'PATCH', body });
      setUser(res.user);
      setSuccess(okMsg);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const changeRole = (role) => confirm({
    title: `Cambiar rol a ${ROLE_LABELS[role]}`,
    message: `${ROLE_EFFECTS[role]}${user.role === 'USER' && user.nutritionist ? ' Su vínculo con su nutricionista se va a terminar.' : ''}`,
    confirmLabel: 'Cambiar rol',
    onConfirm: () => patch({ role }, `Ahora es ${ROLE_LABELS[role]}.`),
  });

  const changePlan = (plan) => confirm({
    title: plan === 'PREMIUM' ? 'Dar NutriVision Pro' : 'Pasar a Gratuito',
    message: plan === 'PREMIUM'
      ? 'Se activa el plan Pro de cortesía, sin vencimiento y sin cobro.'
      : `Vuelve al plan Gratuito.${user.premiumUntil ? ' El Pro por código sigue vigente hasta que venza.' : ''}`,
    confirmLabel: 'Confirmar',
    onConfirm: () => patch({ plan }, plan === 'PREMIUM' ? 'Plan Pro activado.' : 'Plan cambiado a Gratuito.'),
  });

  const toggleBan = () => confirm({
    title: user.banned ? 'Desbanear cuenta' : 'Banear cuenta',
    message: user.banned
      ? 'La cuenta vuelve a poder usar la app.'
      : 'La cuenta no va a poder usar la app hasta que la desbanees. Si es nutricionista, deja de aparecer en el directorio.',
    confirmLabel: user.banned ? 'Desbanear' : 'Banear',
    onConfirm: () => patch({ banned: !user.banned }, user.banned ? 'Cuenta desbaneada.' : 'Cuenta baneada.'),
  });

  const goal = findOption(GOAL_OPTIONS, user?.goal);
  const np = user?.nutritionistProfile;

  return (
    <Screen onRefresh={load}>
      <BackHeader title="Usuario" />
      {!user && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {user ? (
        <>
          <Card style={[styles.hero, user.banned && { backgroundColor: '#FDF3F2' }]}>
            <Avatar uri={user.photoUrl} name={user.name} size={64} />
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={2}>{user.name}</Text>
              <Text style={styles.email} numberOfLines={1} selectable>{user.email}</Text>
              <View style={styles.tags}>
                <Tag label={ROLE_LABELS[user.role]} tone={roleTone(user.role)} />
                {user.role === 'USER' ? <Tag label={user.isPremium ? 'Pro' : 'Gratuito'} tone={user.isPremium ? 'gold' : 'gray'} /> : null}
                {user.banned ? <Tag label="Baneado" tone="red" /> : null}
                {user.isSelf ? <Tag label="Vos" tone="green" /> : null}
              </View>
            </View>
          </Card>

          <Card style={{ gap: 2 }}>
            <SectionHeader title="Datos" />
            <Row label="Alta" value={fmtDate(user.createdAt)} />
            <Row label="Inicio de sesión" value={user.provider === 'GOOGLE' ? 'Google' : 'Correo y contraseña'} />
            {user.role === 'USER' ? (
              <>
                <Row label="Edad" value={user.age ? `${user.age} años` : '—'} />
                <Row label="Objetivo" value={goal?.label || (user.onboardingCompleted ? '—' : 'Todavía no completó sus datos')} />
                <Row label="Platos registrados" value={String(user.mealsCount)} />
                <Row label="Último plato" value={fmtDate(user.lastMealAt)} />
                <Row label="Nutricionista" value={user.nutritionist?.name || 'Sin vínculo'} />
                {user.premiumUntil ? <Row label="Pro por código" value={`hasta el ${fmtDate(user.premiumUntil)}`} /> : null}
              </>
            ) : null}
          </Card>

          {np ? (
            <Pressable onPress={() => router.push(`/admin-nutricionista/${np.id}`)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <Card style={{ gap: 6 }}>
                <View style={styles.npHead}>
                  <Text style={styles.h3}>Perfil de nutricionista</Text>
                  <ChevronRight size={18} color={colors.inkMuted} />
                </View>
                <View style={styles.tags}>
                  <Tag label={NUTRI_STATUS_LABELS[np.status]} tone={statusTone(np.status)} />
                  <Tag label={np.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={np.subscriptionActive ? 'green' : 'gray'} />
                </View>
                <Text style={styles.email}>Matrícula {np.licenseNumber} · {np.activePatients} {np.activePatients === 1 ? 'paciente' : 'pacientes'}</Text>
              </Card>
            </Pressable>
          ) : null}

          {/* Acciones */}
          <Card style={{ gap: 12 }}>
            <SectionHeader title="Rol" />
            <Segmented options={ROLE_OPTIONS} value={user.role} onChange={changeRole} disabled={busy || user.isSelf} />
            {user.isSelf ? <Text style={styles.note}>No podés cambiar tu propio rol.</Text> : null}
          </Card>

          {user.role === 'USER' ? (
            <Card style={{ gap: 12 }}>
              <SectionHeader title="Plan" />
              <Segmented options={PLAN_OPTIONS} value={user.plan} onChange={changePlan} disabled={busy} />
              <Text style={styles.note}>Cambiar el plan desde acá no genera cobros: el Pro dado por un administrador no vence. Las suscripciones pagas se manejan con Mercado Pago.</Text>
            </Card>
          ) : null}

          {!user.isSelf ? (
            <Pressable
              onPress={toggleBan}
              disabled={busy}
              style={({ pressed }) => [user.banned ? styles.unbanBtn : styles.banBtn, (pressed || busy) && { opacity: 0.7 }]}
            >
              {user.banned ? <UserCheck size={18} color={colors.primaryDark} /> : <Ban size={18} color={colors.danger} />}
              <Text style={user.banned ? styles.unbanText : styles.banText}>{user.banned ? 'Desbanear cuenta' : 'Banear cuenta'}</Text>
            </Pressable>
          ) : (
            <View style={styles.selfNote}>
              <ShieldCheck size={16} color={colors.inkSoft} />
              <Text style={styles.note}>Esta es tu cuenta de administrador.</Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  email: { fontSize: 13, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  h3: { fontSize: 16, fontWeight: '800', color: colors.ink },
  npHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { width: 130, fontSize: 13, color: colors.inkSoft },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  banBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft,
  },
  banText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  unbanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft,
  },
  unbanText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  selfNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
