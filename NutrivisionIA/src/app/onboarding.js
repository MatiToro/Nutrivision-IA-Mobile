import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Brain, LogOut } from 'lucide-react-native';
import { ChipGroup, NumberField, OptionCard } from '../components/Form';
import { Message } from '../components/AuthUI';
import { PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { confirm } from '../utils/confirm';
import { api } from '../api/client';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS, checkRange, parseBirthDate, toNumber } from '../constants/profile';
import { colors, gradients, radius, shadow } from '../theme';

const TOTAL_STEPS = 3;

/**
 * Formulario de objetivos al registrarse (igual que /onboarding en la Web):
 * 1) fecha de nacimiento, altura, peso y sexo, 2) nivel de actividad, 3) objetivo.
 * La edad no se pide: se calcula desde la fecha de nacimiento y se actualiza sola.
 * Al terminar, PUT /api/users/me/onboarding calcula las metas en el backend.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setProfile, profile, logout, changeRole } = useAuth();
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const heightRef = useRef(null);
  const weightRef = useRef(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ day: '', month: '', year: '', heightCm: '', weightKg: '', sex: null, activityLevel: null, goal: null });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const firstName = (profile?.displayName || '').split(' ')[0];

  function validateStep() {
    if (step === 1) {
      return (
        parseBirthDate(form.day, form.month, form.year).error
        || checkRange('heightCm', 'La altura', form.heightCm)
        || checkRange('weightKg', 'El peso', form.weightKg)
        || (!form.sex ? 'Elegí tu sexo biológico.' : null)
      );
    }
    if (step === 2) return form.activityLevel ? null : 'Elegí tu nivel de actividad.';
    return form.goal ? null : 'Elegí tu objetivo.';
  }

  async function handleNext() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      const data = await api('/users/me/onboarding', {
        method: 'PUT',
        body: {
          birthDate: parseBirthDate(form.day, form.month, form.year).iso,
          heightCm: toNumber(form.heightCm),
          weightKg: toNumber(form.weightKg),
          sex: form.sex,
          activityLevel: form.activityLevel,
          goal: form.goal,
        },
      });
      setProfile(data.user);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (saving) return <CalculatingScreen />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 18, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {step > 1 ? (
            <Pressable onPress={() => { setError(null); setStep((s) => s - 1); }} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Paso anterior">
              <ArrowLeft size={20} color={colors.ink} />
            </Pressable>
          ) : <View style={{ width: 40 }} />}
          <Text style={styles.stepText}>Paso {step} de {TOTAL_STEPS}</Text>
          <Pressable onPress={logout} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Cerrar sesión">
            <LogOut size={18} color={colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.track}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>

        {step === 1 && (
          <View style={{ gap: 16 }}>
            <View>
              <Text style={styles.title}>{firstName ? `¡Hola, ${firstName}! ` : ''}Contanos sobre vos</Text>
              <Text style={styles.subtitle}>Necesitamos estos datos para calcular tus metas personalizadas.</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Fecha de nacimiento</Text>
              <View style={styles.row}>
                <NumberField
                  placeholder="DD" value={form.day} maxLength={2} style={{ flex: 1 }}
                  onChangeText={(t) => { update('day', t); if (t.length === 2) monthRef.current?.focus(); }}
                  accessibilityLabel="Día de nacimiento"
                />
                <NumberField
                  inputRef={monthRef} placeholder="MM" value={form.month} maxLength={2} style={{ flex: 1 }}
                  onChangeText={(t) => { update('month', t); if (t.length === 2) yearRef.current?.focus(); }}
                  accessibilityLabel="Mes de nacimiento"
                />
                <NumberField
                  inputRef={yearRef} placeholder="AAAA" value={form.year} maxLength={4} style={{ flex: 1.4 }}
                  onChangeText={(t) => { update('year', t); if (t.length === 4) heightRef.current?.focus(); }}
                  accessibilityLabel="Año de nacimiento"
                />
              </View>
              <Text style={styles.hint}>{birthHint(form)}</Text>
            </View>
            <View style={styles.row}>
              <NumberField
                inputRef={heightRef} label="Altura" unit="cm" placeholder="170" value={form.heightCm} style={{ flex: 1 }}
                onChangeText={(t) => update('heightCm', t)} returnKeyType="next"
                onSubmitEditing={() => weightRef.current?.focus()} submitBehavior="submit"
              />
              <NumberField
                inputRef={weightRef} label="Peso actual" unit="kg" placeholder="70,0" decimal value={form.weightKg} style={{ flex: 1 }}
                onChangeText={(t) => update('weightKg', t)}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Sexo biológico</Text>
              <ChipGroup options={SEX_OPTIONS} value={form.sex} onChange={(v) => update('sex', v)} />
              <Text style={styles.hint}>Se usa para la fórmula del gasto calórico (Mifflin-St Jeor). No se puede cambiar después.</Text>
            </View>
            <Pressable
              onPress={() => confirm({
                title: 'Cuenta de nutricionista',
                message: 'Esta cuenta pasa a ser de nutricionista: vas a cargar tu matrícula y un administrador la va a revisar. Para usar la app como paciente vas a necesitar otra cuenta.',
                confirmLabel: 'Soy nutricionista',
                onConfirm: () => changeRole('NUTRITIONIST').catch((err) => setError(err.message)),
              })}
              style={styles.nutriLink}
              hitSlop={6}
            >
              <Text style={styles.nutriLinkText}>¿Sos nutricionista? Creá tu cuenta profesional</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 12 }}>
            <View>
              <Text style={styles.title}>Nivel de actividad</Text>
              <Text style={styles.subtitle}>¿Cuál te describe mejor?</Text>
            </View>
            {ACTIVITY_OPTIONS.map((o) => (
              <OptionCard key={o.value} option={o} active={form.activityLevel === o.value} onPress={() => update('activityLevel', o.value)} />
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 12 }}>
            <View>
              <Text style={styles.title}>¿Cuál es tu objetivo?</Text>
              <Text style={styles.subtitle}>Lo vas a poder cambiar cuando quieras desde tu Perfil.</Text>
            </View>
            {GOAL_OPTIONS.map((o) => (
              <OptionCard key={o.value} option={o} active={form.goal === o.value} onPress={() => update('goal', o.value)} />
            ))}
          </View>
        )}

        {error ? <Message>{error}</Message> : null}

        <PrimaryButton
          label={step < TOTAL_STEPS ? 'Continuar' : 'Calcular mis metas'}
          icon={<ArrowRight size={18} color="#fff" />}
          onPress={handleNext}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Muestra la edad calculada apenas la fecha es válida. */
function birthHint({ day, month, year }) {
  if (!day || !month || year.length < 4) return 'Tu edad se calcula sola y se actualiza cada año.';
  const { age, error } = parseBirthDate(day, month, year);
  return error || `Tenés ${age} años.`;
}

/** Pantalla de espera mientras el backend calcula las metas. */
function CalculatingScreen() {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.calc}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={gradients.primary} style={styles.calcIcon}>
          <Brain size={40} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={[styles.title, { textAlign: 'center', marginTop: 20 }]}>Calculando tus metas…</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', maxWidth: 260 }]}>Estamos armando tu plan nutricional personalizado</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  nutriLink: { alignSelf: 'center', paddingVertical: 6 },
  nutriLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  stepText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 11, color: colors.inkMuted },
  calc: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  calcIcon: { width: 96, height: 96, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', ...shadow.float },
});
