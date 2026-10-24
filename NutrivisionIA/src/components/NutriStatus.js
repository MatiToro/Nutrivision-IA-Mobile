import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClipboardList, Clock3, LogOut, RefreshCw, XCircle } from 'lucide-react-native';
import { Card, PrimaryButton, Screen } from './ui';
import { Message } from './AuthUI';
import { useAuth } from '../context/AuthContext';
import { useNutri } from '../context/NutriContext';
import { confirm } from '../utils/confirm';
import { colors, radius } from '../theme';

/**
 * Pantalla de la cuenta de nutricionista mientras no está aprobada:
 * sin solicitud → completarla; PENDING → en revisión; REJECTED → motivo y reenviar.
 */
export default function NutriStatus() {
  const router = useRouter();
  const { logout, profile: user } = useAuth();
  const { data, refresh, error } = useNutri();
  const profile = data?.profile;
  const firstName = (user?.displayName || '').replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ')[0];

  const onLogout = () => confirm({
    title: 'Cerrar sesión',
    message: '¿Querés cerrar la sesión en este teléfono?',
    confirmLabel: 'Cerrar sesión',
    onConfirm: () => { logout(); },
  });

  let icon;
  let title;
  let text;
  let action;
  if (!data && error) {
    icon = <RefreshCw size={34} color={colors.danger} />;
    title = 'Sin conexión con el servidor';
    text = error;
    action = <PrimaryButton label="Reintentar" onPress={refresh} />;
  } else if (!profile) {
    icon = <ClipboardList size={34} color={colors.primary} />;
    title = `¡Hola${firstName ? `, ${firstName}` : ''}!`;
    text = 'Para empezar a trabajar con pacientes en NutriVision, completá tu solicitud profesional con tu matrícula.';
    action = <PrimaryButton label="Completar solicitud" onPress={() => router.push('/nutri-solicitud')} />;
  } else if (profile.status === 'REJECTED') {
    icon = <XCircle size={34} color={colors.danger} />;
    title = 'Tu solicitud fue rechazada';
    text = 'Podés corregir tus datos y volver a enviarla.';
    action = <PrimaryButton label="Corregir y reenviar" onPress={() => router.push('/nutri-solicitud')} />;
  } else {
    icon = <Clock3 size={34} color={colors.accent} />;
    title = 'Solicitud en revisión';
    text = 'Un administrador está verificando tu matrícula. Cuando te apruebe vas a poder activar tu suscripción y ver a tus pacientes.';
    action = <PrimaryButton variant="ghost" label="Editar solicitud" onPress={() => router.push('/nutri-solicitud')} />;
  }

  return (
    <Screen onRefresh={refresh}>
      <View style={styles.top}>
        <Pressable onPress={onLogout} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Cerrar sesión">
          <LogOut size={18} color={colors.inkSoft} />
        </Pressable>
      </View>

      <Card style={styles.card}>
        <View style={styles.icon}>{icon}</View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        {profile?.status === 'REJECTED' && profile.rejectionReason ? (
          <View style={{ alignSelf: 'stretch' }}><Message>Motivo: {profile.rejectionReason}</Message></View>
        ) : null}
        <View style={{ alignSelf: 'stretch', marginTop: 6 }}>{action}</View>
      </Card>

      {profile ? (
        <Card style={{ gap: 8 }}>
          <Text style={styles.h3}>Datos enviados</Text>
          <Row label="Nombre" value={user?.displayName} />
          <Row label="Matrícula" value={profile.licenseNumber} />
          <Row label="Especialidades" value={profile.specialties.join(', ') || '—'} />
          <Row label="Enviada" value={new Date(profile.createdAt).toLocaleDateString('es-AR')} last />
        </Card>
      ) : null}

      {error ? <Message>{error}</Message> : null}
      <Pressable onPress={refresh} style={styles.refresh} hitSlop={6}>
        <RefreshCw size={14} color={colors.primary} />
        <Text style={styles.refreshText}>Actualizar estado</Text>
      </Pressable>
    </Screen>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 21, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 20 },
  h3: { fontSize: 16, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { width: 110, fontSize: 13, color: colors.inkSoft },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', padding: 6, borderRadius: radius.pill },
  refreshText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
