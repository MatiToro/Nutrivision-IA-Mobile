import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, KeyRound, Search, ShieldCheck, Unlink } from 'lucide-react-native';
import { Card, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { Message } from '../components/AuthUI';
import { Avatar, BackHeader, RatingLine, SpecialtyTags } from '../components/Nutritionist';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { confirm } from '../utils/confirm';
import { colors, radius } from '../theme';

// Lo que el nutricionista va a poder ver y hacer (se muestra antes de aceptar).
const SHARED = [
  'Tus comidas registradas, con foto y macros',
  'Tu progreso diario y semanal',
  'Tu evolución de peso',
  'Tus datos de perfil, objetivo y metas diarias',
  'Va a poder ajustar tu objetivo y tus metas (te vamos a avisar cuando lo haga)',
];

const sinceText = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Mi nutricionista: vincularse con código + consentimiento, ver el vínculo y desvincularse. */
export default function MyNutritionistScreen() {
  const router = useRouter();
  const { myLink, refreshLink } = useApp();

  return (
    <Screen onRefresh={refreshLink}>
      <BackHeader title="Mi nutricionista" />
      {myLink === undefined ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : myLink ? (
        <LinkedView link={myLink} onChanged={refreshLink} />
      ) : (
        <LinkForm onLinked={refreshLink} />
      )}

      <Pressable onPress={() => router.push('/nutricionistas')} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <Card style={styles.rowCard}>
          <View style={styles.rowIcon}><Search size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Buscar nutricionistas</Text>
            <Text style={styles.rowText}>Mirá perfiles, especialidades y valoraciones.</Text>
          </View>
          <ChevronRight size={18} color={colors.inkMuted} />
        </Card>
      </Pressable>
    </Screen>
  );
}

function LinkedView({ link, onChanged }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const n = link.nutritionist;

  const unlink = () => confirm({
    title: 'Desvincularte',
    message: `${n.name} va a dejar de ver tu progreso y tus comidas. Tu valoración se mantiene y la vas a poder seguir editando.`,
    confirmLabel: 'Desvincularme',
    onConfirm: async () => {
      setBusy(true);
      setError(null);
      try {
        await api('/links/me', { method: 'DELETE' });
        await onChanged();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <>
      <Card style={styles.linkedCard}>
        <Avatar uri={n.photoUrl} name={n.name} size={72} />
        <Text style={styles.linkedName}>{n.name}</Text>
        <Text style={styles.linkedSub}>Matrícula {n.licenseNumber} · vinculados desde el {sinceText(link.since)}</Text>
        <RatingLine rating={n.rating} />
        <SpecialtyTags items={n.specialties} />
        <PrimaryButton label="Ver perfil y contacto" onPress={() => router.push(`/nutricionistas/${n.id}`)} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.formHead}>
          <ShieldCheck size={18} color={colors.primary} />
          <Text style={styles.formTitle}>Qué puede ver tu nutricionista</Text>
        </View>
        {SHARED.map((s) => <Bullet key={s} text={s} />)}
      </Card>

      {error ? <Message>{error}</Message> : null}

      <Pressable onPress={unlink} disabled={busy} style={({ pressed }) => [styles.unlinkBtn, (pressed || busy) && { opacity: 0.7 }]}>
        <Unlink size={18} color={colors.danger} />
        <Text style={styles.unlinkText}>{busy ? 'Desvinculando…' : 'Desvincularme'}</Text>
      </Pressable>
    </>
  );
}

function LinkForm({ onLinked }) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const clean = code.replace(/[\s-]/g, '').toUpperCase();

  async function checkCode() {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/links/preview?code=${encodeURIComponent(clean)}`);
      setPreview(data.nutritionist);
      setConsent(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    setBusy(true);
    setError(null);
    try {
      await api('/links', { method: 'POST', body: { code: clean, consent: true } });
      await onLinked();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <>
        <Card style={styles.linkedCard}>
          <Avatar uri={preview.photoUrl} name={preview.name} size={72} />
          <Text style={styles.linkedName}>{preview.name}</Text>
          <Text style={styles.linkedSub}>Matrícula {preview.licenseNumber}</Text>
          <RatingLine rating={preview.rating} />
          <SpecialtyTags items={preview.specialties} />
        </Card>

        {/* Consentimiento explícito antes de compartir datos */}
        <Card style={{ gap: 10 }}>
          <View style={styles.formHead}>
            <ShieldCheck size={18} color={colors.primary} />
            <Text style={styles.formTitle}>Antes de vincularte</Text>
          </View>
          <Text style={styles.rowText}>Al vincularte, {preview.name} va a poder ver:</Text>
          {SHARED.map((s) => <Bullet key={s} text={s} />)}
          <Text style={styles.rowText}>Podés desvincularte cuando quieras desde esta pantalla.</Text>
          <Pressable onPress={() => setConsent((v) => !v)} style={styles.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
            <View style={[styles.check, consent && styles.checkOn]}>{consent ? <Check size={14} color="#fff" strokeWidth={3} /> : null}</View>
            <Text style={styles.consentText}>Acepto compartir mi información con este nutricionista.</Text>
          </Pressable>
        </Card>

        {error ? <Message>{error}</Message> : null}
        <PrimaryButton label={busy ? 'Vinculando…' : 'Vincularme'} onPress={link} disabled={!consent || busy} />
        <PrimaryButton variant="ghost" label="Usar otro código" onPress={() => { setPreview(null); setError(null); }} disabled={busy} />
      </>
    );
  }

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={styles.formHead}>
          <KeyRound size={18} color={colors.primary} />
          <Text style={styles.formTitle}>Vinculate con tu nutricionista</Text>
        </View>
        <Text style={styles.rowText}>
          Pedile a tu nutricionista su código de vinculación e ingresalo acá. Vas a ver con quién te vinculás antes de aceptar.
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t); setError(null); }}
          placeholder="Ej: K7M2QX9P"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          style={styles.codeInput}
          returnKeyType="go"
          onSubmitEditing={() => clean.length >= 4 && checkCode()}
        />
        {error ? <Message>{error}</Message> : null}
        <PrimaryButton label={busy ? 'Buscando…' : 'Continuar'} onPress={checkCode} disabled={clean.length < 4 || busy} />
      </Card>
      <SectionHeader title="¿No tenés nutricionista?" />
      <Text style={[styles.rowText, { marginTop: -8 }]}>Buscá uno en el directorio y contactalo para empezar.</Text>
    </>
  );
}

function Bullet({ text }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot}><Check size={12} color={colors.primary} strokeWidth={3} /></View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  rowText: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  linkedCard: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  linkedName: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 4 },
  linkedSub: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bulletText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingVertical: 4 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  codeInput: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, fontWeight: '800', letterSpacing: 3, color: colors.ink, textAlign: 'center',
  },
  unlinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerSoft,
  },
  unlinkText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
