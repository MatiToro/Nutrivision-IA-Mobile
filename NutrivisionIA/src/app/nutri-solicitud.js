import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, Send } from 'lucide-react-native';
import { Card, PrimaryButton, Screen } from '../components/ui';
import { Message } from '../components/AuthUI';
import { BackHeader } from '../components/Nutritionist';
import { NutriProfileFields, formFromProfile, nutriFormBody, validateNutriForm } from '../components/NutriForm';
import { useAuth } from '../context/AuthContext';
import { useNutri } from '../context/NutriContext';
import { api } from '../api/client';
import { confirm } from '../utils/confirm';
import { colors } from '../theme';

/**
 * Solicitud de alta como nutricionista: matrícula, descripción,
 * especialidades y contactos. Queda "En revisión" hasta que un Administrador
 * la apruebe. También sirve para corregir y reenviar una solicitud rechazada.
 */
export default function NutriApplicationScreen() {
  const router = useRouter();
  const { profile: user, changeRole } = useAuth();
  const { data, apply } = useNutri();
  const current = data?.profile;
  const [form, setForm] = useState(() => formFromProfile(current, user?.displayName));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit() {
    const problem = validateNutriForm(form, { withLicense: true });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const res = await api('/nutritionist/me/application', { method: 'PUT', body: nutriFormBody(form, { withLicense: true }) });
      apply(res);
      if (router.canGoBack()) router.back();
      else router.replace('/pacientes');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const notNutri = () => confirm({
    title: 'Usar la app como paciente',
    message: 'Esta cuenta pasa a ser de usuario (paciente) y se descarta la solicitud de nutricionista.',
    confirmLabel: 'Soy usuario',
    onConfirm: () => changeRole('USER').catch((err) => setError(err.message)),
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <BackHeader title={current ? 'Editar solicitud' : 'Solicitud profesional'} />

        <Card style={styles.intro}>
          <BadgeCheck size={22} color={colors.primary} />
          <Text style={styles.introText}>
            Completá tus datos profesionales. Un administrador verifica tu matrícula y, cuando te apruebe, vas a poder activar tu suscripción y aparecer en el directorio.
          </Text>
        </Card>

        {current?.status === 'REJECTED' && current.rejectionReason ? (
          <Message>Motivo del rechazo: {current.rejectionReason}</Message>
        ) : null}

        <Card>
          <NutriProfileFields form={form} update={update} />
        </Card>

        {error ? <Message>{error}</Message> : null}
        <PrimaryButton
          label={saving ? 'Enviando…' : current ? 'Reenviar solicitud' : 'Enviar solicitud'}
          icon={saving ? null : <Send size={18} color="#fff" />}
          onPress={submit}
          disabled={saving}
        />

        {!current || current.status !== 'APPROVED' ? (
          <Pressable onPress={notNutri} style={styles.link} hitSlop={6}>
            <Text style={styles.linkText}>No soy nutricionista: quiero usar la app como paciente</Text>
          </Pressable>
        ) : null}
        <View style={{ height: 12 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.primarySoft },
  introText: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 19 },
  link: { alignSelf: 'center', paddingVertical: 4 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textAlign: 'center', textDecorationLine: 'underline' },
});
