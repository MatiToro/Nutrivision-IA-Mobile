import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown, CreditCard, RefreshCw, ShieldCheck, Ticket, X } from 'lucide-react-native';
import { Card, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { Message } from '../components/AuthUI';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { confirm } from '../utils/confirm';
import {
  cancelSubscription, formatARS, longDay, shortDay, syncSubscription, useMercadoPagoCheckout,
} from '../utils/checkout';
import { colors, gradients, radius, shadow } from '../theme';

// Funciones según los Requisitos Mobile
const FEATURES = [
  { label: 'Coach IA en cada escaneo', free: true, pro: true },
  { label: 'Heladera y lista de compras', free: true, pro: true },
  { label: 'Agua, rachas e historial', free: true, pro: true },
  { label: 'Recetas con tu heladera', free: false, pro: true },
  { label: 'Faltantes a la lista en 1 toque', free: false, pro: true },
  { label: 'Acceso a nutricionistas profesionales', free: false, pro: true },
  { label: 'Sin anuncios', free: false, pro: true },
];

const PLAN_LABEL = { PRO_MONTHLY: 'Pro mensual', PRO_ANNUAL: 'Pro anual' };

/**
 * Plan y suscripción: NutriVision Pro mensual o anual con Mercado Pago
 * (débito automático). La primera vez, 7 días gratis: Mercado Pago pide la
 * tarjeta pero el primer cobro es al terminar la prueba.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isPremium, paidPro, premiumByCode, premiumUntil, freeDailyScanLimit, refreshData } = useApp();
  const { setProfile } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState('PRO_ANNUAL');
  const [busy, setBusy] = useState(null);
  const [waitingId, setWaitingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const applyBilling = useCallback(async (data) => {
    setBilling(data);
    if (data?.user) setProfile(data.user);
    await refreshData(); // límite de escaneos y demás datos del plan
  }, [setProfile, refreshData]);

  // Al abrir la pantalla el backend puede activar el Pro (re-consulta a Mercado
  // Pago si quedó un pago pendiente): por eso se actualiza también el perfil,
  // para que el resto de la app (escaneos, recetas, anuncios) se entere.
  const load = useCallback(async () => {
    try {
      await applyBilling(await api('/payments/me'));
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [applyBilling]);


  useEffect(() => { load(); }, [load]);

  /** Al volver de Mercado Pago: consulta el estado real de la suscripción. */
  const checkPayment = useCallback(async (id) => {
    setBusy('sync');
    setError(null);
    try {
      const data = await syncSubscription(id);
      await applyBilling(data);
      const sub = data.synced;
      if (sub?.status === 'AUTHORIZED') {
        setWaitingId(null);
        setSuccess(sub.inTrial
          ? `¡Listo! Empezó tu prueba gratis de NutriVision Pro. El primer cobro de ${formatARS(sub.amount)} es el ${longDay(sub.trialEndsAt)}; si cancelás antes, no pagás nada.`
          : '¡Listo! Ya tenés NutriVision Pro.');
      } else {
        setWaitingId(id);
        setSuccess(null);
      }
    } catch (err) {
      setWaitingId(id);
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, [applyBilling]);

  const { start } = useMercadoPagoCheckout(checkPayment);

  // Volvió por el link de retorno (nutrivisionia://premium?pago=volver&sub=...)
  useEffect(() => {
    if (params.pago === 'volver' && typeof params.sub === 'string') checkPayment(params.sub);
  }, [params.pago, params.sub, checkPayment]);

  async function subscribe() {
    setBusy('start');
    setError(null);
    setSuccess(null);
    try {
      const data = await start(selected);
      setWaitingId(data.subscriptionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const sub = billing?.subscription;
  const onCancel = () => confirm({
    title: 'Cancelar NutriVision Pro',
    message: sub?.inTrial
      ? `No se te va a cobrar nada. Seguís con Pro hasta el ${longDay(sub.accessUntil)} y después volvés al plan Gratuito.`
      : `Se corta el débito automático. Seguís con Pro hasta el ${longDay(sub.accessUntil)} (ya está pago) y después volvés al plan Gratuito.`,
    confirmLabel: 'Cancelar suscripción',
    onConfirm: async () => {
      setBusy('cancel');
      setError(null);
      setSuccess(null);
      try {
        await applyBilling(await cancelSubscription(sub.id));
        setSuccess(`Cancelaste la suscripción. Seguís con NutriVision Pro hasta el ${longDay(sub.accessUntil)}.`);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(null);
      }
    },
  });

  const features = [
    { label: 'Escaneos de platos con IA', free: `${freeDailyScanLimit} por día`, pro: 'Ilimitados' },
    ...FEATURES,
  ];
  const cell = (v) =>
    typeof v === 'string' ? <Text style={styles.cellText}>{v}</Text>
      : v ? <Check size={18} color={colors.primary} strokeWidth={3} />
        : <X size={18} color={colors.inkMuted} />;

  const plans = billing?.plans ?? [];
  const monthly = plans.find((p) => p.kind === 'PRO_MONTHLY');
  const chosen = plans.find((p) => p.kind === selected);
  const trialDays = chosen?.trialDays || 0;
  // Pro sin suscripción (dado por un administrador): no se ofrece pagar.
  const proWithoutSub = paidPro && !sub;
  const canSubscribe = billing && !sub && !proWithoutSub;

  return (
    <Screen onRefresh={load}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={10} accessibilityLabel="Cerrar">
          <X size={20} color={colors.ink} />
        </Pressable>
      </View>

      <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.crown}><Crown size={30} color={colors.accent} /></View>
        <Text style={styles.heroTitle}>NutriVision Pro</Text>
        <Text style={styles.heroText}>Sin límites de escaneo, recetas inteligentes y sin anuncios.</Text>
      </LinearGradient>

      <Card style={{ gap: 6 }}>
        <View style={styles.current}>
          <Text style={styles.currentLabel}>Tu plan actual</Text>
          <Text style={styles.currentValue}>{isPremium ? 'NutriVision Pro' : 'Gratuito'}</Text>
        </View>
        {sub ? <SubscriptionStatus sub={sub} /> : null}
        {proWithoutSub ? <Text style={styles.currentHint}>Pro activado por un administrador.</Text> : null}
        {premiumByCode ? <Text style={styles.currentHint}>Activado con el código de tu nutricionista, hasta el {longDay(premiumUntil)}.</Text> : null}
      </Card>

      {!billing && !loadError ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
      {loadError ? <Message>{loadError}</Message> : null}

      {canSubscribe ? (
        <View style={{ gap: 10 }}>
          {plans.map((p) => (
            <PlanOption
              key={p.kind}
              plan={p}
              monthly={monthly}
              selected={selected === p.kind}
              onPress={() => setSelected(p.kind)}
            />
          ))}
        </View>
      ) : null}

      <Card style={{ paddingVertical: 8 }}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.featLabel, styles.head]}>Función</Text>
          <Text style={[styles.col, styles.head]}>Gratis</Text>
          <Text style={[styles.col, styles.head, { color: colors.accent }]}>Pro</Text>
        </View>
        {features.map((f, i) => (
          <View key={f.label} style={[styles.row, i === features.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.featLabel}>{f.label}</Text>
            <View style={styles.col}>{cell(f.free)}</View>
            <View style={styles.col}>{cell(f.pro)}</View>
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

      {premiumByCode && canSubscribe ? (
        <Text style={styles.codeNote}>
          Cuando venza tu código volvés al plan Gratuito. Si querés seguir con Pro después, podés suscribirte.
        </Text>
      ) : null}

      {sub && sub.status === 'AUTHORIZED' ? (
        <Pressable onPress={onCancel} disabled={!!busy} style={({ pressed }) => [styles.cancelBtn, (pressed || busy) && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>{busy === 'cancel' ? 'Cancelando…' : 'Cancelar suscripción'}</Text>
        </Pressable>
      ) : null}

      {canSubscribe && chosen ? (
        <>
          <PrimaryButton
            label={busy === 'start' ? 'Abriendo Mercado Pago…' : trialDays ? `Probar ${trialDays} días gratis` : `Suscribirme por ${formatARS(chosen.amount)}`}
            icon={busy === 'start' ? null : <Crown size={18} color="#fff" />}
            onPress={subscribe}
            disabled={!!busy}
          />
          <View style={styles.note}>
            <ShieldCheck size={16} color={colors.inkSoft} />
            <Text style={styles.noteText}>
              {trialDays
                ? `Te pedimos una tarjeta en Mercado Pago, pero no se cobra nada durante ${trialDays} días. Después se cobra ${formatARS(chosen.amount)} ${chosen.months === 12 ? 'por año' : 'por mes'} con débito automático. Cancelá antes y no pagás nada.`
                : `Se cobra ${formatARS(chosen.amount)} ${chosen.months === 12 ? 'por año' : 'por mes'} con débito automático en Mercado Pago. Podés cancelar cuando quieras.`}
            </Text>
          </View>
        </>
      ) : null}

      {!isPremium ? <RedeemCard onRedeemed={(msg) => { setError(null); setSuccess(msg); }} /> : null}

      {billing?.payments?.length ? (
        <Card>
          <SectionHeader title="Tus pagos" />
          {billing.payments.map((p, i) => (
            <View key={p.id} style={[styles.payment, i === billing.payments.length - 1 && { borderBottomWidth: 0 }]}>
              <View>
                <Text style={styles.paymentText}>{PLAN_LABEL[p.kind] || 'NutriVision Pro'}</Text>
                <Text style={styles.paymentDate}>{shortDay(p.paidAt)}</Text>
              </View>
              <Text style={styles.paymentAmount}>{formatARS(p.amount)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.note}>
        <CreditCard size={16} color={colors.inkSoft} />
        <Text style={styles.noteText}>Los pagos los procesa Mercado Pago. NutriVision IA no guarda los datos de tu tarjeta.</Text>
      </View>
    </Screen>
  );
}

function SubscriptionStatus({ sub }) {
  const name = PLAN_LABEL[sub.kind];
  const per = sub.kind === 'PRO_ANNUAL' ? 'por año' : 'por mes';
  let text;
  if (sub.cancelled) text = `${name} cancelado. Seguís con Pro hasta el ${longDay(sub.accessUntil)}.`;
  else if (sub.inTrial) text = `${name}: prueba gratis hasta el ${longDay(sub.trialEndsAt)}. Primer cobro: ${formatARS(sub.amount)} ese día.`;
  else if (sub.nextPaymentAt) text = `${name} (${formatARS(sub.amount)} ${per}). Próximo cobro: ${longDay(sub.nextPaymentAt)}.`;
  else text = `${name} activo hasta el ${longDay(sub.accessUntil)}.`;
  return <Text style={styles.currentHint}>{text}</Text>;
}

function PlanOption({ plan, monthly, selected, onPress }) {
  const annual = plan.months === 12;
  const perMonth = Math.round(plan.amount / plan.months);
  const saving = annual && monthly ? Math.round((1 - plan.amount / (monthly.amount * 12)) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.planHead}>
          <Text style={styles.planName}>{annual ? 'Anual' : 'Mensual'}</Text>
          {saving > 0 ? <View style={styles.saveTag}><Text style={styles.saveText}>Ahorrás {saving}%</Text></View> : null}
        </View>
        <Text style={styles.planPrice}>
          {formatARS(plan.amount)}<Text style={styles.planPer}>{annual ? ' / año' : ' / mes'}</Text>
        </Text>
        {annual ? <Text style={styles.planSub}>Equivale a {formatARS(perMonth)} por mes</Text> : null}
        {plan.trialDays ? <Text style={styles.planTrial}>{plan.trialDays} días gratis</Text> : null}
      </View>
    </Pressable>
  );
}

/** Canje de código Premium de un nutricionista: 30 días de Pro gratis. */
function RedeemCard({ onRedeemed }) {
  const { setProfile } = useAuth();
  const { refreshData } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const clean = code.replace(/[\s-]/g, '').toUpperCase();

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const data = await api('/premium-codes/redeem', { method: 'POST', body: { code: clean } });
      setProfile(data.user);
      await refreshData();
      setCode('');
      onRedeemed(`¡Código canjeado! Tenés NutriVision Pro hasta el ${longDay(data.premiumUntil)}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.redeemHead}>
        <Ticket size={18} color={colors.accent} />
        <Text style={styles.redeemTitle}>¿Tenés un código de tu nutricionista?</Text>
      </View>
      <Text style={styles.noteText}>Canjealo y obtené 1 mes de NutriVision Pro sin costo.</Text>
      <View style={styles.redeemRow}>
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t); setError(null); }}
          placeholder="Código"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          style={styles.redeemInput}
          onSubmitEditing={() => clean.length >= 4 && redeem()}
        />
        <Pressable onPress={redeem} disabled={clean.length < 4 || busy} style={[styles.redeemBtn, (clean.length < 4 || busy) && { opacity: 0.5 }]}>
          <Text style={styles.redeemBtnText}>{busy ? '…' : 'Canjear'}</Text>
        </Pressable>
      </View>
      {error ? <Message>{error}</Message> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  currentHint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  codeNote: { fontSize: 13, color: colors.inkSoft, lineHeight: 18, textAlign: 'center' },
  redeemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redeemTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  redeemRow: { flexDirection: 'row', gap: 8 },
  redeemInput: {
    flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, fontWeight: '800', letterSpacing: 2, color: colors.ink,
  },
  redeemBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  redeemBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  hero: { borderRadius: radius.lg, padding: 22, alignItems: 'center', gap: 8 },
  crown: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#3D2A05' },
  heroText: { fontSize: 14, color: '#4F3808', textAlign: 'center' },
  current: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentLabel: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  currentValue: { fontSize: 15, fontWeight: '800', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  headRow: { paddingTop: 6 },
  head: { fontSize: 12, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase' },
  featLabel: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: '600', paddingRight: 8 },
  col: { width: 72, alignItems: 'center', textAlign: 'center' },
  cellText: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  cancelText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  plan: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: '#FFFBF2' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accent },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  saveTag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  saveText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  planPrice: { fontSize: 22, fontWeight: '800', color: colors.ink },
  planPer: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  planSub: { fontSize: 12, color: colors.inkSoft },
  planTrial: { fontSize: 12, fontWeight: '800', color: '#8A6212', marginTop: 2 },
  waitTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  payment: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  paymentText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  paymentDate: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  paymentAmount: { fontSize: 14, color: colors.ink, fontWeight: '800' },
  noteText: { flex: 1, fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
});
