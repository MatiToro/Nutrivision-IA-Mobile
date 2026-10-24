import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, CircleX, UserRound } from 'lucide-react-native';
import { Card, PrimaryButton, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar, BackHeader, ContactList, RatingLine, SpecialtyTags } from '../../components/Nutritionist';
import { NUTRI_STATUS_LABELS, Tag, statusTone } from '../../components/Admin';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { colors, radius } from '../../theme';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Revisión de una solicitud de nutricionista: aprobar o rechazar con motivo. */
export default function AdminNutritionistScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api(`/admin/nutritionists/${id}`);
      setN(res.nutritionist);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    // load es asíncrona: el estado se actualiza al llegar la respuesta.
    load();
  }, [load]);

  async function act(path, body, okMsg) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api(`/admin/nutritionists/${id}/${path}`, { method: 'POST', body });
      setN(res.nutritionist);
      setSuccess(okMsg);
      setRejecting(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const approve = () => confirm({
    title: 'Aprobar nutricionista',
    message: `Verificaste la matrícula ${n.licenseNumber}. ${n.name} va a poder activar su suscripción, aparecer en el directorio y vincular pacientes.`,
    confirmLabel: 'Aprobar',
    onConfirm: () => act('approve', undefined, 'Nutricionista aprobado.'),
  });

  const reject = () => {
    if (reason.trim().length < 5) {
      setError('Escribí el motivo del rechazo (al menos 5 caracteres). El nutricionista lo va a ver.');
      return;
    }
    confirm({
      title: n.status === 'APPROVED' ? 'Revocar aprobación' : 'Rechazar solicitud',
      message: n.status === 'APPROVED'
        ? 'Deja de aparecer en el directorio y pierde acceso a las fichas de sus pacientes. Puede corregir y volver a enviar la solicitud.'
        : 'El nutricionista va a ver el motivo y va a poder corregir y reenviar su solicitud.',
      confirmLabel: n.status === 'APPROVED' ? 'Revocar' : 'Rechazar',
      onConfirm: () => act('reject', { reason: reason.trim() }, n.status === 'APPROVED' ? 'Aprobación revocada.' : 'Solicitud rechazada.'),
    });
  };

  return (
    <Screen onRefresh={load}>
      <BackHeader title="Nutricionista" />
      {!n && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {n ? (
        <>
          <Card style={styles.hero}>
            <Avatar uri={n.photoUrl} name={n.name} size={72} />
            <Text style={styles.name}>{n.name}</Text>
            <Text style={styles.meta} selectable>{n.email}</Text>
            <View style={styles.tags}>
              <Tag label={NUTRI_STATUS_LABELS[n.status]} tone={statusTone(n.status)} />
              {n.status === 'APPROVED' ? <Tag label={n.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={n.subscriptionActive ? 'green' : 'gray'} /> : null}
              {n.banned ? <Tag label="Baneado" tone="red" /> : null}
            </View>
          </Card>

          {/* Lo que hay que verificar */}
          <Card style={styles.license}>
            <Text style={styles.licenseLabel}>Matrícula declarada</Text>
            <Text style={styles.licenseValue} selectable>{n.licenseNumber}</Text>
            <Text style={styles.note}>Verificala en el registro oficial de matrículas antes de aprobar.</Text>
          </Card>

          <Card style={{ gap: 2 }}>
            <SectionHeader title="Solicitud" />
            <Row label="Enviada / actualizada" value={fmtDate(n.updatedAt)} />
            <Row label="Primera solicitud" value={fmtDate(n.createdAt)} />
            {n.reviewedAt ? <Row label="Última revisión" value={`${fmtDate(n.reviewedAt)}${n.reviewedBy ? ` · ${n.reviewedBy}` : ''}`} /> : null}
            {n.status === 'REJECTED' && n.rejectionReason ? <Row label="Motivo del rechazo" value={n.rejectionReason} /> : null}
            {n.status === 'APPROVED' ? (
              <>
                <Row label="Pacientes activos" value={String(n.activePatients)} />
                <Row label="Suscripción" value={n.subscriptionActive ? `hasta el ${fmtDate(n.subscriptionUntil)}` : 'Inactiva'} />
              </>
            ) : null}
          </Card>

          <Card style={{ gap: 8 }}>
            <SectionHeader title="Perfil profesional" />
            <Text style={styles.bio}>{n.bio || 'Sin descripción.'}</Text>
            <SpecialtyTags items={n.specialties} />
            {n.status === 'APPROVED' ? <RatingLine rating={n.rating} /> : null}
          </Card>

          <Card style={{ gap: 8 }}>
            <SectionHeader title="Contacto" />
            <ContactList contacts={n.contacts} />
          </Card>

          {/* Acciones */}
          {n.status !== 'APPROVED' ? (
            <PrimaryButton label={busy ? 'Guardando…' : 'Aprobar'} icon={busy ? null : <CircleCheck size={18} color="#fff" />} onPress={approve} disabled={busy} />
          ) : null}

          {n.status !== 'REJECTED' ? (
            rejecting ? (
              <Card style={{ gap: 10 }}>
                <Text style={styles.h3}>{n.status === 'APPROVED' ? 'Motivo para revocar' : 'Motivo del rechazo'}</Text>
                <TextInput
                  value={reason}
                  onChangeText={(t) => { setReason(t); setError(null); }}
                  placeholder="Ej: la matrícula no figura en el registro oficial."
                  placeholderTextColor={colors.inkMuted}
                  style={styles.reason}
                  multiline
                  maxLength={300}
                  autoFocus
                />
                <Text style={styles.note}>El nutricionista va a ver este motivo en su app.</Text>
                <View style={styles.actions}>
                  <PrimaryButton variant="ghost" label="Cancelar" onPress={() => { setRejecting(false); setReason(''); }} disabled={busy} style={{ flex: 1 }} />
                  <Pressable onPress={reject} disabled={busy} style={({ pressed }) => [styles.rejectBtn, { flex: 1 }, (pressed || busy) && { opacity: 0.7 }]}>
                    <Text style={styles.rejectText}>{n.status === 'APPROVED' ? 'Revocar' : 'Rechazar'}</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <Pressable onPress={() => setRejecting(true)} style={({ pressed }) => [styles.rejectOutline, pressed && { opacity: 0.8 }]}>
                <CircleX size={18} color={colors.danger} />
                <Text style={styles.rejectOutlineText}>{n.status === 'APPROVED' ? 'Revocar aprobación' : 'Rechazar solicitud'}</Text>
              </Pressable>
            )
          ) : null}

          <Pressable onPress={() => router.push(`/admin-usuario/${n.userId}`)} style={styles.link} hitSlop={6}>
            <UserRound size={15} color={colors.primary} />
            <Text style={styles.linkText}>Ver cuenta (rol, baneo)</Text>
          </Pressable>
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
  hero: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 4 },
  meta: { fontSize: 13, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 4 },
  license: { gap: 4, backgroundColor: colors.accentSoft },
  licenseLabel: { fontSize: 12, fontWeight: '700', color: '#8A6212', textTransform: 'uppercase', letterSpacing: 0.4 },
  licenseValue: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: 1 },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  h3: { fontSize: 16, fontWeight: '800', color: colors.ink },
  bio: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { width: 140, fontSize: 13, color: colors.inkSoft },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  reason: {
    minHeight: 80, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: 12,
    fontSize: 14, color: colors.ink, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.danger },
  rejectText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  rejectOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft,
  },
  rejectOutlineText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
