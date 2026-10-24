import { forwardRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, gradients, radius, shadow } from '../theme';

const logo = require('../../assets/logo.png');

/** Contenedor de las pantallas de login/registro: encabezado verde con logo + tarjeta blanca. */
export function AuthLayout({ title, subtitle, children }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <View style={styles.logoWrap}>
            <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Logo de NutriVision IA" />
          </View>
          <Text style={styles.brand}>NutriVision IA</Text>
          <Text style={styles.tagline}>Tu nutrición, con una foto.</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={{ gap: 12, marginTop: 18 }}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Campo de texto con ícono; si es contraseña, incluye el botón de mostrar/ocultar. */
export const AuthInput = forwardRef(function AuthInput({ icon: Icon, secure, style, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.inputWrap, focused && styles.inputFocused, style]}>
      {Icon ? <Icon size={18} color={focused ? colors.primary : colors.inkMuted} /> : null}
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor={colors.inkMuted}
        secureTextEntry={secure && hidden}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}>
          {hidden ? <Eye size={18} color={colors.inkMuted} /> : <EyeOff size={18} color={colors.inkMuted} />}
        </Pressable>
      ) : null}
    </View>
  );
});

export function Divider({ label = 'o' }) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

/** Logo "G" de Google (mismo que usa la Web). */
function GoogleIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.1 35.9 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}

/** Botón "Continuar con Google". */
export function GoogleButton({ onPress, loading = false, disabled = false }) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.googleBtn, (pressed || off) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel="Continuar con Google"
      accessibilityState={{ disabled: off, busy: loading }}
    >
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <GoogleIcon />}
      <Text style={styles.googleText}>{loading ? 'Conectando con Google…' : 'Continuar con Google'}</Text>
    </Pressable>
  );
}

export function Message({ tone = 'error', children }) {
  const isError = tone === 'error';
  return (
    <View style={[styles.msg, { backgroundColor: isError ? colors.dangerSoft : colors.primarySoft }]} accessibilityLiveRegion="polite">
      <Text style={{ color: isError ? colors.danger : colors.primaryDark, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoWrap: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  logo: { width: 50, height: 70 },
  brand: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12, letterSpacing: -0.3 },
  tagline: { color: '#fff', opacity: 0.85, fontSize: 14, marginTop: 2 },
  card: {
    marginTop: -32, marginHorizontal: 18, backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: 22, ...shadow.card,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.line,
    borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.primary },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.inkMuted, fontSize: 13 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: 13, backgroundColor: colors.surface,
  },
  googleText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  msg: { borderRadius: radius.md, padding: 12 },
});
