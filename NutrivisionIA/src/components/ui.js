import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame } from 'lucide-react-native';
import { colors, gradients, radius, shadow, type } from '../theme';

const logo = require('../../assets/logo.png');

/** Contenedor de pantalla con scroll y márgenes seguros. `onRefresh` activa "deslizar para actualizar". */
export function Screen({ children, scroll = true, contentStyle, onRefresh }) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const padding = { paddingTop: insets.top + 8, paddingBottom: 32 };
  if (!scroll) return <View style={[styles.screen, padding, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Encabezado con logo real de la app + racha. */
export function AppHeader({ streak = 0 }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Logo de NutriVision IA" />
        <Text style={styles.brandText}>
          NutriVision <Text style={{ color: colors.primary }}>IA</Text>
        </Text>
      </View>
      <View style={styles.streak} accessibilityLabel={`Racha de ${streak} días`}>
        <Flame size={16} color={streak > 0 ? '#F97316' : colors.inkMuted} fill={streak > 0 ? '#FDBA74' : 'transparent'} />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </View>
  );
}

export function ScreenTitle({ title, subtitle, right }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.h1}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.h3}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({ label, icon, tone = 'primary', style }) {
  const tones = {
    primary: { bg: colors.primarySoft, fg: colors.primaryDark },
    accent: { bg: colors.accentSoft, fg: '#8A6212' },
    neutral: { bg: colors.bg, fg: colors.inkSoft },
    light: { bg: 'rgba(255,255,255,0.2)', fg: '#fff' },
  };
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, disabled, style, variant = 'solid' }) {
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.ghostBtn, disabled && styles.disabled, pressed && styles.pressed, style]}
      >
        {icon}
        <Text style={styles.ghostBtnText}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [disabled && styles.disabled, pressed && styles.pressed, style]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
        {icon}
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{text}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 40 },
  brandText: { fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, ...shadow.card,
  },
  streakText: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, ...shadow.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionAction: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md,
    paddingVertical: 13, paddingHorizontal: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ghostBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  empty: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 12 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
});
