import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { ArrowRight, Check, Lock, Mail, Stethoscope, User, UserRound } from 'lucide-react-native';
import { AuthInput, AuthLayout, Divider, GoogleButton, Message } from '../components/AuthUI';
import LegalModal from '../components/LegalModal';
import { PrimaryButton } from '../components/ui';
import { authErrorMessage, useAuth } from '../context/AuthContext';
import { colors } from '../theme';

// Tipo de cuenta (un rol por cuenta: para ser paciente y nutricionista se usan correos distintos).
const ACCOUNT_TYPES = [
  { value: 'USER', label: 'Soy usuario', hint: 'Quiero cuidar mi alimentación', Icon: UserRound },
  { value: 'NUTRITIONIST', label: 'Soy nutricionista', hint: 'Quiero seguir a mis pacientes', Icon: Stethoscope },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Registro con correo y contraseña. Mismas validaciones que la Web. */
export default function RegisterScreen() {
  const { register, loginWithGoogle } = useAuth();
  const emailRef = useRef(null);
  const passRef = useRef(null);
  const confirmRef = useRef(null);
  const [form, setForm] = useState({ role: 'USER', name: '', email: '', password: '', confirm: '', terms: false });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function handleRegister() {
    setError(null);
    setInfo(null);
    if (!form.name.trim()) return setError('Escribí tu nombre.');
    if (!EMAIL_RE.test(form.email.trim())) return setError('El correo no es válido.');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.');
    if (!form.terms) return setError('Tenés que aceptar los Términos y la Política de Privacidad para continuar.');

    setSubmitting(true);
    try {
      await register({ email: form.email, password: form.password, displayName: form.name.trim(), role: form.role });

    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
    return undefined;
  }

  // Primero se elige el tipo de cuenta y después se continúa con Google (igual que en la Web).
  // Al continuar con Google se aceptan los Términos (lo dice el texto debajo del botón).
  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle({ role: form.role });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Comenzá tu viaje nutricional hoy mismo">
      <View style={styles.types} accessibilityRole="radiogroup">
        {ACCOUNT_TYPES.map(({ value, label, hint, Icon }) => {
          const active = form.role === value;
          return (
            <Pressable
              key={value}
              onPress={() => update('role', value)}
              style={[styles.type, active && styles.typeActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Icon size={22} color={active ? colors.primary : colors.inkMuted} />
              <Text style={[styles.typeLabel, active && { color: colors.primaryDark }]}>{label}</Text>
              <Text style={styles.typeHint}>{hint}</Text>
            </Pressable>
          );
        })}
      </View>
      {form.role === 'NUTRITIONIST' ? (
        <Text style={styles.typeNote}>
          Después de crear la cuenta vas a cargar tu matrícula. Un administrador la revisa antes de que aparezcas en el directorio.
        </Text>
      ) : null}
      <AuthInput
        icon={User}
        value={form.name}
        onChangeText={(t) => update('name', t)}
        placeholder={form.role === 'NUTRITIONIST' ? 'Nombre profesional (ej: Lic. Ana Pérez)' : 'Nombre completo'}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={100}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <AuthInput
        ref={emailRef}
        icon={Mail}
        value={form.email}
        onChangeText={(t) => update('email', t)}
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        submitBehavior="submit"
      />
      <AuthInput
        ref={passRef}
        icon={Lock}
        secure
        value={form.password}
        onChangeText={(t) => update('password', t)}
        placeholder="Contraseña (mín. 6 caracteres)"
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <AuthInput
        ref={confirmRef}
        icon={Lock}
        secure
        value={form.confirm}
        onChangeText={(t) => update('confirm', t)}
        placeholder="Repetir contraseña"
        autoComplete="new-password"
        returnKeyType="done"
      />

      <Pressable
        onPress={() => update('terms', !form.terms)}
        style={styles.terms}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.terms }}
      >
        <View style={[styles.check, form.terms && styles.checkOn]}>
          {form.terms ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
        </View>
        <Text style={styles.termsText}>
          Acepto los{' '}
          <Text style={styles.termsLink} onPress={() => setLegalDoc('terms')} accessibilityRole="link">Términos y Condiciones</Text>
          {' '}y la{' '}
          <Text style={styles.termsLink} onPress={() => setLegalDoc('privacy')} accessibilityRole="link">Política de Privacidad</Text>
        </Text>
      </Pressable>

      {error ? <Message>{error}</Message> : null}
      {info ? <Message tone="success">{info}</Message> : null}

      <PrimaryButton
        label={submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        icon={submitting ? null : <ArrowRight size={18} color="#fff" />}
        onPress={handleRegister}
        disabled={submitting || googleLoading}
      />

      <Divider />
      <GoogleButton onPress={handleGoogle} loading={googleLoading} disabled={submitting} />
      <Text style={styles.googleNote}>
        Al continuar con Google aceptás los{' '}
        <Text style={styles.termsLink} onPress={() => setLegalDoc('terms')} accessibilityRole="link">Términos</Text>
        {' '}y la{' '}
        <Text style={styles.termsLink} onPress={() => setLegalDoc('privacy')} accessibilityRole="link">Política de Privacidad</Text>.
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tenés cuenta? </Text>
        <Link href="/login" replace style={styles.footerLink}>Iniciá sesión</Link>
      </View>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  types: { flexDirection: 'row', gap: 10 },
  type: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  typeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeLabel: { fontSize: 14, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  typeHint: { fontSize: 11, color: colors.inkSoft, textAlign: 'center' },
  typeNote: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkOn: { backgroundColor: colors.primary },
  termsText: { flex: 1, fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  termsLink: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  googleNote: { fontSize: 12, color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginTop: -4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  footerText: { color: colors.inkSoft, fontSize: 14 },
  footerLink: { color: colors.primary, fontWeight: '800', fontSize: 14 },
});
