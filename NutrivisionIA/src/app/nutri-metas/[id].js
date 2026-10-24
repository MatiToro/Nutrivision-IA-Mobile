import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { Card, PrimaryButton, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { BackHeader } from '../../components/Nutritionist';
import { NumberField, OptionCard } from '../../components/Form';
import { api } from '../../api/client';
import { confirm } from '../../utils/confirm';
import { GOAL_OPTIONS, checkRange, toNumber } from '../../constants/profile';
import { colors } from '../../theme';

const MACROS = [
  { key: 'dailyCalorieGoal', label: 'Calorías', unit: 'kcal', name: 'Las calorías' },
  { key: 'dailyProteinGoalG', label: 'Proteínas', unit: 'g', name: 'Las proteínas' },
  { key: 'dailyCarbsGoalG', label: 'Carbohidratos', unit: 'g', name: 'Los carbohidratos' },
  { key: 'dailyFatGoalG', label: 'Grasas', unit: 'g', name: 'Las grasas' },
];

/**
 * El nutricionista edita el objetivo y las metas diarias del paciente.
 * Mismas reglas que cuando las cambia el paciente: si cambia el objetivo y no se
 * tocan los números, las metas se recalculan solas; los números escritos a mano
 * tienen prioridad. El paciente ve un aviso una sola vez.
 */
export default function EditPatientGoalsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(null);
  const [macrosTouched, setMacrosTouched] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/nutritionist/patients/${id}`);
      const p = res.patient;
      setPatient(p);
      setForm({
        goal: p.goal,
        dailyCalorieGoal: p.dailyCalorieGoal != null ? String(p.dailyCalorieGoal) : '',
        dailyProteinGoalG: p.dailyProteinGoalG != null ? String(p.dailyProteinGoalG) : '',
        dailyCarbsGoalG: p.dailyCarbsGoalG != null ? String(p.dailyCarbsGoalG) : '',
        dailyFatGoalG: p.dailyFatGoalG != null ? String(p.dailyFatGoalG) : '',
      });
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };
  const updateMacro = (key, value) => { update(key, value); setMacrosTouched(true); };

  function buildPayload() {
    if (macrosTouched) {
      for (const m of MACROS) {
        const problem = checkRange(m.key, m.name, form[m.key], { integer: true });
        if (problem) return { problem };
      }
    }
    const payload = {};
    if (form.goal && form.goal !== patient.goal) payload.goal = form.goal;
    if (macrosTouched) {
      MACROS.forEach(({ key }) => {
        const n = toNumber(form[key]);
        if (n !== patient[key]) payload[key] = n;
      });
    }
    return { payload };
  }

  async function send(payload) {
    setSaving(true);
    try {
      await api(`/nutritionist/patients/${id}/goals`, { method: 'PATCH', body: payload });
      router.back();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function save() {
    const { problem, payload } = buildPayload();
    if (problem) {
      setError(problem);
      return;
    }
    if (!Object.keys(payload).length) {
      setError('No cambiaste nada.');
      return;
    }
    if (payload.goal) {
      confirm({
        title: 'Cambiar objetivo',
        message: `Al cambiar el objetivo, el gráfico de peso de ${patient.name.split(' ')[0]} arranca de nuevo desde su peso actual${macrosTouched ? '' : ' y las metas se recalculan solas'}.`,
        confirmLabel: 'Cambiar',
        onConfirm: () => send(payload),
      });
      return;
    }
    send(payload);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <BackHeader title="Objetivo y metas" />
        {!form && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
        {form ? (
          <>
            <Text style={styles.intro}>
              Paciente: <Text style={{ fontWeight: '800', color: colors.ink }}>{patient.name}</Text>. Va a ver un aviso en su app con las metas nuevas.
            </Text>

            <Card style={{ gap: 10 }}>
              <SectionHeader title="Objetivo" />
              {GOAL_OPTIONS.map((o) => (
                <OptionCard key={o.value} option={o} compact active={form.goal === o.value} onPress={() => update('goal', o.value)} />
              ))}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeader title="Metas diarias" />
              <Text style={styles.note}>
                {macrosTouched
                  ? 'Se van a usar estos valores: tienen prioridad sobre el cálculo automático.'
                  : 'Si cambiás el objetivo y no tocás estos números, se recalculan solos con los datos del paciente.'}
              </Text>
              <View style={styles.grid}>
                {MACROS.map(({ key, label, unit }) => (
                  <NumberField
                    key={key}
                    label={label}
                    unit={unit}
                    value={form[key]}
                    onChangeText={(t) => updateMacro(key, t)}
                    style={{ flexBasis: '46%', flexGrow: 1 }}
                  />
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {error ? <Message>{error}</Message> : null}
        {form ? (
          <PrimaryButton label={saving ? 'Guardando…' : 'Guardar cambios'} icon={saving ? null : <Save size={18} color="#fff" />} onPress={save} disabled={saving} />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
