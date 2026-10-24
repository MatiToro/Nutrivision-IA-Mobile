import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ArrowRight, BellRing, ChevronRight, Camera, ChefHat, Refrigerator, ShoppingCart, Sparkles, Stethoscope, Utensils, WifiOff } from 'lucide-react-native';
import { AppHeader, Badge, Card, EmptyState, Screen, SectionHeader } from '../../components/ui';
import { CalorieRing, MacroBar, WaterTracker } from '../../components/Nutrition';
import { Avatar } from '../../components/Nutritionist';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { colors, gradients, radius, shadow, type } from '../../theme';
import { greeting, longDate, sameDay } from '../../utils/dates';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, streak, meals, waterToday, changeWater, dataError, refreshData, myLink, refreshLink } = useApp();
  const { backendError, refreshProfile, setProfile } = useAuth();
  const [dismissingNotice, setDismissingNotice] = useState(false);
  const connectionError = backendError || dataError;

  const refreshAll = async () => {
    try {
      await refreshProfile();
    } catch {
      // el aviso de conexión queda visible
    }
    await Promise.all([refreshData(), refreshLink()]);
  };

  // Aviso único: "tu nutricionista cambió tus metas"
  const dismissGoalsNotice = async () => {
    setDismissingNotice(true);
    try {
      const data = await api('/users/me/goals-notice/seen', { method: 'POST' });
      setProfile(data.user);
    } catch {
      setDismissingNotice(false);
    }
  };

  const today = new Date();
  const todayMeals = meals.filter((m) => sameDay(new Date(m.loggedAt), today));
  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.totalCalories || 0),
      proteinG: acc.proteinG + (m.totalProteinG || 0),
      carbsG: acc.carbsG + (m.totalCarbsG || 0),
      fatG: acc.fatG + (m.totalFatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const firstName = (profile?.displayName || '').split(' ')[0];

  const macros = [
    { id: 'p', label: 'Proteínas', value: totals.proteinG, goal: profile?.dailyProteinGoalG, color: '#93C5FD' },
    { id: 'c', label: 'Carbs', value: totals.carbsG, goal: profile?.dailyCarbsGoalG, color: '#FDE047' },
    { id: 'f', label: 'Grasas', value: totals.fatG, goal: profile?.dailyFatGoalG, color: '#FCA5A5' },
  ];

  const quick = [
    { key: 'heladera', label: 'Heladera', icon: Refrigerator, bg: colors.primarySoft, fg: colors.primary, onPress: () => router.push({ pathname: '/cocina', params: { seccion: 'heladera' } }) },
    { key: 'compras', label: 'Compras', icon: ShoppingCart, bg: colors.waterSoft, fg: colors.water, onPress: () => router.push({ pathname: '/cocina', params: { seccion: 'compras' } }) },
    { key: 'recetas', label: 'Recetas', icon: ChefHat, bg: colors.accentSoft, fg: colors.accent, onPress: () => router.push({ pathname: '/cocina', params: { seccion: 'recetas' } }) },
    { key: 'nutricionistas', label: 'Nutricionistas', icon: Stethoscope, bg: '#EDE9FE', fg: colors.fiber, onPress: () => router.push('/nutricionistas') },
  ];

  return (
    <Screen onRefresh={refreshAll}>
      <AppHeader streak={streak} />

      {connectionError ? (
        <Card style={styles.notice}>
          <WifiOff size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Sin conexión con el servidor</Text>
            <Text style={styles.noticeText}>{connectionError}</Text>
          </View>
          <Pressable onPress={refreshAll} hitSlop={8}>
            <Text style={styles.noticeAction}>Reintentar</Text>
          </Pressable>
        </Card>
      ) : null}


      {profile?.goalsNoticePending ? (
        <Card style={styles.goalsNotice}>
          <View style={styles.goalsHead}>
            <View style={styles.goalsIcon}><BellRing size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Tu nutricionista actualizó tus metas</Text>
              <Text style={styles.noticeText}>
                Nuevas metas diarias: {profile.dailyCalorieGoal ?? '—'} kcal · {profile.dailyProteinGoalG ?? '—'} g proteínas · {profile.dailyCarbsGoalG ?? '—'} g carbs · {profile.dailyFatGoalG ?? '—'} g grasas.
              </Text>
            </View>
          </View>
          <View style={styles.goalsActions}>
            <Pressable onPress={() => router.push('/perfil')} hitSlop={6}>
              <Text style={styles.noticeAction}>Ver en mi perfil</Text>
            </Pressable>
            <Pressable onPress={dismissGoalsNotice} disabled={dismissingNotice} style={styles.okBtn}>
              <Text style={styles.okText}>{dismissingNotice ? '…' : 'Entendido'}</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <View>
        <Text style={type.h1}>{firstName ? `¡${greeting()}, ${firstName}!` : `¡${greeting()}!`}</Text>
        <Text style={[type.small, { marginTop: 2 }]}>Tu objetivo está más cerca de lo que pensás. ¡Vamos!</Text>
      </View>

      {/* Progreso del día. Al tocarlo se abre el progreso semanal y mensual. */}
      <Pressable onPress={() => router.push('/progreso')} style={({ pressed }) => [pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLabel="Tu progreso del día. Ver progreso semanal y mensual">
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.progress}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Tu progreso del día</Text>
          <View style={styles.progressHeadRight}>
            <Badge tone="light" label={longDate(today)} />
            <ChevronRight size={18} color="#fff" />
          </View>
        </View>
        <View style={styles.progressBody}>
          <CalorieRing consumed={totals.calories} goal={profile?.dailyCalorieGoal} size={128} />
          <View style={styles.macros}>
            {macros.map(({ id, ...m }) => <MacroBar key={id} light {...m} />)}
          </View>
        </View>
        {!profile?.dailyCalorieGoal ? (
          <Text style={styles.progressNote}>Tus metas diarias aparecerán cuando se cargue tu perfil.</Text>
        ) : null}
        <Text style={styles.progressLink}>Ver mi semana y mi mes</Text>
      </LinearGradient>
      </Pressable>

      {/* CTA de escaneo */}
      <Pressable onPress={() => router.push('/escanear')} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
        <View style={styles.scanCard}>
          <View style={{ flex: 1, gap: 6 }}>
            <Badge label="Escaneo con IA" icon={<Sparkles size={12} color={colors.primaryDark} />} style={{ backgroundColor: colors.surface }} />
            <Text style={type.h2}>¿Qué hay en tu plato?</Text>
            <Text style={type.small}>Sacá una foto de tu comida y obtené los macros al instante.</Text>
            <View style={styles.scanLink}>
              <Text style={styles.scanLinkText}>Escanear plato</Text>
              <ArrowRight size={16} color={colors.primary} />
            </View>
          </View>
          <LinearGradient colors={gradients.primary} style={styles.scanIcon}>
            <Camera size={34} color="#fff" />
          </LinearGradient>
        </View>
      </Pressable>

      {/* Agua */}
      <Card>
        <WaterTracker glasses={waterToday} onChange={changeWater} />
      </Card>

      {/* Nutricionista */}
      {myLink !== undefined && (!profile?.role || profile.role === 'USER') ? (
        <Pressable
          onPress={() => router.push(myLink ? `/nutricionistas/${myLink.nutritionist.id}` : '/nutricionistas')}
          style={({ pressed }) => [pressed && { opacity: 0.85 }]}
        >
          <Card style={styles.nutriCard}>
            {myLink ? (
              <Avatar uri={myLink.nutritionist.photoUrl} name={myLink.nutritionist.name} size={46} />
            ) : (
              <View style={styles.nutriIcon}><Stethoscope size={22} color={colors.fiber} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nutriLabel}>{myLink ? 'Tu nutricionista' : 'Encontrá tu nutricionista'}</Text>
              <Text style={styles.nutriName} numberOfLines={1}>
                {myLink ? myLink.nutritionist.name : 'Profesionales que siguen tu progreso'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.inkMuted} />
          </Card>
        </Pressable>
      ) : null}

      {/* Accesos rápidos */}
      <View>
        <SectionHeader title="Accesos rápidos" />
        <View style={styles.quickGrid}>
          {quick.map(({ key, label, icon: Icon, bg, fg, onPress }) => (
            <Pressable key={key} onPress={onPress} style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.8 }]}>
              <View style={[styles.quickIcon, { backgroundColor: bg }]}>
                <Icon size={22} color={fg} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Comidas de hoy */}
      <Card>
        <SectionHeader title="Comidas de hoy" action="Ver historial" onAction={() => router.push('/historial')} />
        {todayMeals.length === 0 ? (
          <EmptyState
            icon={<Utensils size={24} color={colors.primary} />}
            title="Todavía no registraste comidas"
            text="Tocá el botón central para escanear tu primer plato del día."
          />
        ) : (
          todayMeals.map((meal) => (
            <Pressable key={meal.id} onPress={() => router.push(`/comida/${meal.id}`)} style={({ pressed }) => [styles.mealRow, pressed && { opacity: 0.7 }]}>
              {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.mealThumb} /> : null}
              <Text style={styles.mealName} numberOfLines={1}>{meal.name || 'Comida'}</Text>
              <Text style={styles.mealKcal}>{Math.round(meal.totalCalories)} kcal</Text>
              <ChevronRight size={16} color={colors.inkMuted} />
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { borderRadius: radius.lg, padding: 18, gap: 14, ...shadow.card },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  progressTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  progressHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressLink: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 6 },
  progressBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  macros: { flex: 1, gap: 9 },
  progressNote: { color: '#fff', opacity: 0.85, fontSize: 12 },

  scanCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primarySoft,
    borderRadius: radius.lg, padding: 18,
  },
  scanLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  scanLinkText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  scanIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...shadow.float },

  quickGrid: { flexDirection: 'row', gap: 10 },
  quickItem: {
    flex: 1, alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: 4, ...shadow.card,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },

  nutriCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nutriIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  nutriLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  nutriName: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 1 },

  goalsNotice: { gap: 10, padding: 14, backgroundColor: colors.primarySoft },
  goalsHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  goalsIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  goalsActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  okBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  okText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  mealThumb: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.bg },

  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.dangerSoft },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  noticeText: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  noticeAction: { fontSize: 13, fontWeight: '800', color: colors.primary },
  mealName: { fontWeight: '700', color: colors.ink, flex: 1 },
  mealKcal: { fontWeight: '700', color: colors.ink },
});
