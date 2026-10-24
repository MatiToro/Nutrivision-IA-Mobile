import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScanLine } from 'lucide-react-native';
import { colors, gradients, shadow } from '../theme';
import AdBanner from './AdBanner';

const SCAN_ROUTE = 'escanear';
// Pestañas con banner de anuncios (solo plan Gratuito).
const AD_ROUTES = ['index', 'historial', 'cocina'];

/**
 * Barra de navegación inferior con botón central flotante
 * que lleva directo al escáner de platos.
 */
export default function TabBar({ state, descriptors, navigation, insets }) {
  const bottom = Math.max(insets.bottom, 10);
  const showBanner = AD_ROUTES.includes(state.routes[state.index]?.name);

  return (
    <View>
      {showBanner ? <AdBanner /> : null}
      <View style={[styles.wrapper, { paddingBottom: bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        if (route.name === SCAN_ROUTE) {
          return (
            <View key={route.key} style={styles.centerSlot}>
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Escanear plato"
                accessibilityState={focused ? { selected: true } : {}}
                style={({ pressed }) => [styles.centerBtnOuter, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.centerBtn}>
                  <ScanLine size={28} color="#fff" strokeWidth={2.4} />
                </LinearGradient>
              </Pressable>
              <Text style={[styles.label, styles.centerLabel, focused && styles.labelActive]}>Escanear</Text>
            </View>
          );
        }

        const color = focused ? colors.primary : colors.inkMuted;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={focused ? { selected: true } : {}}
            style={styles.tab}
          >
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
            </View>
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 6,
    ...shadow.card,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  iconPill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 },
  iconPillActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 11, fontWeight: '600', color: colors.inkMuted },
  labelActive: { color: colors.primary, fontWeight: '700' },
  centerSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  centerBtnOuter: {
    marginTop: -34,
    padding: 5,
    borderRadius: 999,
    backgroundColor: colors.surface,
    ...shadow.float,
  },
  centerBtn: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { marginTop: 2 },
});
