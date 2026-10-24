import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut, RefreshCw, WifiOff } from 'lucide-react-native';
import { PrimaryButton } from './ui';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../theme';

/**
 * Hay sesión iniciada pero el servidor no devolvió el perfil (sin conexión,
 * demasiados intentos, servidor caído). Como no se sabe el rol de la cuenta,
 * no se muestra ninguna interfaz: se ofrece reintentar o cerrar sesión.
 */
export default function SessionErrorScreen() {
  const insets = useSafeAreaInsets();
  const { backendError, retrySession, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await retrySession();
    setRetrying(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.icon}><WifiOff size={28} color={colors.danger} /></View>
        <Text style={styles.title}>No pudimos conectar con el servidor</Text>
        <Text style={styles.text}>Tu sesión sigue iniciada, pero no pudimos cargar tu cuenta. Revisá tu conexión y probá de nuevo en unos segundos.</Text>
        {backendError ? <Text style={styles.detail}>{backendError}</Text> : null}
        <PrimaryButton
          label={retrying ? 'Reintentando…' : 'Reintentar'}
          icon={retrying ? <ActivityIndicator color="#fff" size="small" /> : <RefreshCw size={17} color="#fff" />}
          onPress={retry}
          disabled={retrying}
          style={{ alignSelf: 'stretch', marginTop: 8 }}
        />
        <PrimaryButton
          variant="ghost"
          label="Cerrar sesión"
          icon={<LogOut size={17} color={colors.primary} />}
          onPress={logout}
          disabled={retrying}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 10, ...shadow.card },
  icon: { width: 60, height: 60, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 20 },
  detail: { fontSize: 12, color: colors.inkSoft, textAlign: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden' },
});
