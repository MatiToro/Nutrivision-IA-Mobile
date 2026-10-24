import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Check, CreditCard, Crown, RefreshCw, Share2, ShieldCheck, Ticket } from 'lucide-react-native';
import { Card, PrimaryButton, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { useNutri } from '../../context/NutriContext';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import {
  cancelSubscription, formatARS, longDay, shortDay, syncSubscription, useMercadoPagoCheckout,
} from '../../utils/checkout';
import { colors, gradients, radius } from '../../theme';

// Precio de referencia si el servidor todavía no respondió (el real lo manda GET /payments/me).
const DEFAULT_PRICE = 19990;

const BENEFITS = [
  'Aparecés en el directorio de nutricionistas',
  'Acceso a las fichas y el progreso de tus pacientes',
  'Podés ajustar objetivos y metas de tus pacientes',
  '5 códigos Premium por mes para regalar a tus pacientes',
];

/**
 * Suscripción mensual del nutricionista con Mercado Pago (débito
 * automático) y códigos Premium de cada mes pagado.
 */
export default function SubscriptionScreen() {
  const { data, apply, refresh } = useNutri();
  const params = useLocalSearchParams();
  const [busy, setBusy] = useState(null);
  const [waitingId, setWaitingId] = useState(null);
  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const sub = data?.subscription;
  const mpSub = sub?.mercadoPago;
  const codes = data?.premiumCodes ?? [];
  const available = codes.filter((c) => !c.redeemed && !c.expired).length;

  useEffect(() => {
    api('/payments/me').then((res) => {
      const plan = res.plans?.find((p) => p.kind === 'NUTRITIONIST');
      if (plan) setPrice(plan.amount);
    }).catch(() => {});
  }, []);

  /** Al volver de Mercado Pago: consulta el estado real y recarga la cuenta. */
  const checkPayment = useCallback(async (id) => {
    setBusy('sync');
    setError(null);
    try {
      const res = await syncSubscription(id);
      await refresh();
      if (res.synced?.status === 'AUTHORIZED') {
        setWaitingId(null);
        setSuccess('¡Suscripción activa! Ya aparecés en el directorio y tenés tus 5 códigos del mes.');
      } else {
        setWaitingId(id);
      }
    } catch (err) {
      setWaitingId(id);
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const { start } = useMercadoPagoCheckout(checkPayment);

  // Volvió por el link de retorno (nutrivisionia://suscripcion?pago=volver&sub=...)
  useEffect(() => {
    if (params.pago === 'volver' && typeof params.sub === 'string') checkPayment(params.sub);
  }, [params.pago, params.sub, checkPayment]);

  async function activate() {
    setBusy('start');
    setError(null);
    setSuccess(null);
    try {
      const res = await start('NUTRITIONIST');
      setWaitingId(res.subscriptionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const cancel = () => confirm({
    title: 'Cancelar suscripción',
    message: mpSub
      ? `Se corta el débito automático. Seguís en el directorio, con acceso a tus pacientes y tus códigos, hasta el ${longDay(sub.until)}. Tus vínculos se conservan.`
      : 'Vas a dejar de aparecer en el directorio y no vas a poder ver las fichas de tus pacientes. Los códigos sin usar vencen. Tus vínculos se conservan.',
    confirmLabel: 'Cancelar suscripción',
    onConfirm: async () => {
      setBusy('cancel');
      setError(null);
      setSuccess(null);
      try {
        if (mpSub) {
          await cancelSubscription(mpSub.id);
          await refresh();
          setSuccess(`Cancelaste tu suscripción. Seguís activo hasta el ${longDay(sub.until)}.`);
        } else {
          // Suscripción anterior a Mercado Pago (sin débito automático).
          apply(await api('/nutritionist/me/subscription', { method: 'DELETE' }));
          setSuccess('Cancelaste tu suscripción.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(null);
      }
    },
  });

  const statusText = !sub?.active
    ? 'Activala para aparecer en el directorio y ver a tus pacientes.'
    : mpSub?.cancelled
      ? `Cancelada: activa hasta el ${longDay(sub.until)}`
      : mpSub?.nextPaymentAt
        ? `Próximo cobro: ${formatARS(mpSub.amount)} el ${longDay(mpSub.nextPaymentAt)}`
        : `Hasta el ${longDay(sub.until)}`;
  const canCancel = sub?.active && (!mpSub || mpSub.status === 'AUTHORIZED');

  const shareCode = (code) => Share.share({
    message: `Te regalo 1 mes de NutriVision Pro: en la app andá a Perfil → Plan y suscripción → "¿Tenés un código de tu nutricionista?" e ingresá ${code}.`,
  }).catch(() => {});

  if (!sub) return null;

  return (
    <Screen onRefresh={refresh}>
      <ScreenTitle title="Suscripción" subtitle="Tu plan mensual como nutricionista." />

      <LinearGradient colors={sub.active ? gradients.primary : ['#9AA0A8', '#62666D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><CreditCard size={24} color={sub.active ? colors.primary : colors.inkSoft} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>Estado</Text>
          <Text style={styles.heroTitle}>{sub.active ? 'Activa' : 'Inactiva'}</Text>
          <Text style={styles.heroText}>{statusText}</Text>
        </View>
      </LinearGradient>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Incluye" />
        {BENEFITS.map((b) => (
          <View key={b} style={styles.benefit}>
            <View style={styles.check}><Check size={12} color={colors.primary} strokeWidth={3} /></View>
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </Card>

      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {waitingId && busy !== 'sync' ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.waitTitle}>¿Ya cargaste tu tarjeta en Mercado Pago?</Text>
          <Text style={styles.noteText}>Si recién terminaste, la confirmación puede tardar unos segundos.</Text>
          <PrimaryButton variant="ghost" label="Ya pagué, actualizar" icon={<RefreshCw size={16} color={colors.primary} />} onPress={() => checkPayment(waitingId)} />
        </Card>
      ) : null}
      {busy === 'sync' ? <Message tone="success">Confirmando con Mercado Pago…</Message> : null}

      {canCancel ? (
        <Pressable onPress={cancel} disabled={!!busy} style={({ pressed }) => [styles.cancelBtn, (pressed || busy) && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>{busy === 'cancel' ? 'Cancelando…' : 'Cancelar suscripción'}</Text>
        </Pressable>
      ) : null}
      {!sub.active ? (
        <PrimaryButton
          label={busy === 'start' ? 'Abriendo Mercado Pago…' : `Suscribirme por ${formatARS(price)} / mes`}
          icon={busy === 'start' ? null : <Crown size={18} color="#fff" />}
          onPress={activate}
          disabled={!!busy}
        />
      ) : null}
      <View style={styles.note}>
        <ShieldCheck size={16} color={colors.inkSoft} />
        <Text style={styles.noteText}>
          {`Se cobra ${formatARS(mpSub?.amount || price)} por mes con débito automático en Mercado Pago. Si cancelás, seguís activo hasta el final del mes pagado. NutriVision IA no guarda los datos de tu tarjeta.`}
        </Text>
      </View>

      {/* Códigos Premium del mes */}
      <Card style={{ gap: 10 }}>
        <View style={styles.codesHead}>
          <Ticket size={18} color={colors.accent} />
          <Text style={styles.codesTitle}>Códigos Premium del mes</Text>
        </View>
        {codes.length === 0 ? (
          <Text style={styles.noteText}>Cuando actives tu suscripción vas a recibir 5 códigos. Cada uno le da a un paciente 1 mes de NutriVision Pro gratis.</Text>
        ) : (
          <>
            <Text style={styles.noteText}>
              {sub.active
                ? `Te quedan ${available} de ${codes.length}. Vencen el ${longDay(codes[0].periodEnd)} y no se acumulan.`
                : 'Estos códigos vencieron con tu último mes pagado.'}
            </Text>
            {codes.map((c) => {
              const status = c.redeemed ? `Usado por ${c.redeemedBy}${c.redeemedAt ? ` el ${shortDay(c.redeemedAt)}` : ''}` : c.expired ? 'Vencido' : 'Disponible';
              const usable = !c.redeemed && !c.expired;
              return (
                <View key={c.code} style={[styles.code, !usable && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.codeText, !usable && styles.codeUsed]} selectable>{c.code}</Text>
                    <Text style={[styles.codeStatus, usable && { color: colors.primary }]}>{status}</Text>
                  </View>
                  {usable ? (
                    <Pressable onPress={() => shareCode(c.code)} style={styles.shareBtn} hitSlop={6} accessibilityLabel={`Compartir código ${c.code}`}>
                      <Share2 size={16} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </Card>

      {data.payments.length ? (
        <Card>
          <SectionHeader title="Historial de pagos" />
          {data.payments.map((p, i) => (
            <View key={p.id} style={[styles.payment, i === data.payments.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.paymentText}>{shortDay(p.periodStart)} → {shortDay(p.periodEnd)}</Text>
              <Text style={[styles.paymentAmount, p.amount ? styles.paymentPaid : null]}>{p.amount ? formatARS(p.amount) : 'Sin cobro'}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroText: { color: '#fff', opacity: 0.92, fontSize: 13, marginTop: 2 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  benefitText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  cancelText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  codesHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codesTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  code: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  codeText: { fontSize: 17, fontWeight: '800', letterSpacing: 2, color: colors.ink },
  codeUsed: { textDecorationLine: 'line-through', color: colors.inkSoft },
  codeStatus: { fontSize: 12, color: colors.inkSoft, marginTop: 2, fontWeight: '600' },
  shareBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payment: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  paymentText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  paymentAmount: { fontSize: 13, color: colors.inkSoft },
  paymentPaid: { fontSize: 14, color: colors.ink, fontWeight: '800' },
  waitTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
