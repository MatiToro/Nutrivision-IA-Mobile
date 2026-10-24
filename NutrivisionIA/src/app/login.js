import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { ArrowRight, Lock, Mail } from 'lucide-react-native';
import { AuthInput, AuthLayout, Divider, GoogleButton, Message } from '../components/AuthUI';
import { PrimaryButton } from '../components/ui';
import { authErrorMessage, useAuth } from '../context/AuthContext';
import { colors } from '../theme';

/** Inicio de sesión + recuperación de contraseña. */
export default function LoginScreen() {
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Completá tu correo y tu contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Escribí tu correo arriba primero, así sabemos a dónde mandarte el link.');
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email);
      setInfo(`Te enviamos un correo a ${email.trim()} con un link para restablecer tu contraseña.`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Iniciá sesión con tu cuenta de NutriVision IA">
      <AuthInput
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        placeholder="Correo electrónico"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <AuthInput
        ref={passwordRef}
        icon={Lock}
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <Pressable onPress={handleForgot} disabled={resetting} style={styles.forgot} hitSlop={6}>
        <Text style={styles.forgotText}>{resetting ? 'Enviando…' : '¿Olvidaste tu contraseña?'}</Text>
      </Pressable>

      {error ? <Message>{error}</Message> : null}
      {info ? <Message tone="success">{info}</Message> : null}

      <PrimaryButton
        label={submitting ? 'Ingresando…' : 'Iniciar sesión'}
        icon={submitting ? null : <ArrowRight size={18} color="#fff" />}
        onPress={handleLogin}
        disabled={submitting || googleLoading}
      />

      <Divider />
      <GoogleButton onPress={handleGoogle} loading={googleLoading} disabled={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tenés cuenta? </Text>
        <Link href="/registro" replace style={styles.footerLink}>Creá una</Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -2 },
  forgotText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  footerText: { color: colors.inkSoft, fontSize: 14 },
  footerLink: { color: colors.primary, fontWeight: '800', fontSize: 14 },
});
