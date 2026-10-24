import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Beef, Cake, Camera, ChevronRight, Crown, Droplet, Flame, Lock, LogOut, Pencil, Ruler, Search, Stethoscope, Target,
  TrendingUp, User, Users, Weight, Wheat,
} from 'lucide-react-native';
import { Badge, Card, PrimaryButton, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { NumberField, OptionCard, TextField } from '../../components/Form';
import { Message } from '../../components/AuthUI';
import WeightChart from '../../components/WeightChart';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  ACTIVITY_OPTIONS, GOAL_OPTIONS, LIMITS, SEX_OPTIONS, checkRange, displayAge, findOption, toNumber,
} from '../../constants/profile';
import { confirm } from '../../utils/confirm';
import { appendImage } from '../../utils/formImage';
import { colors, gradients, radius } from '../../theme';

const MACROS = [
  { key: 'dailyCalorieGoal', label: 'Calorías', unit: 'kcal', color: colors.primary, Icon: Flame },
  { key: 'dailyProteinGoalG', label: 'Proteínas', unit: 'g', color: colors.protein, Icon: Beef },
  { key: 'dailyCarbsGoalG', label: 'Carbohidratos', unit: 'g', color: colors.carbs, Icon: Wheat },
  { key: 'dailyFatGoalG', label: 'Grasas', unit: 'g', color: colors.fats, Icon: Droplet },
];

const str = (v) => (v === null || v === undefined ? '' : String(v));
const formFrom = (p) => ({
  displayName: p?.displayName || '',
  weightKg: str(p?.weightKg),
  heightCm: str(p?.heightCm),
  activityLevel: p?.activityLevel ?? null,
  goal: p?.goal ?? null,
  dailyCalorieGoal: str(p?.dailyCalorieGoal),
  dailyProteinGoalG: str(p?.dailyProteinGoalG),
  dailyCarbsGoalG: str(p?.dailyCarbsGoalG),
  dailyFatGoalG: str(p?.dailyFatGoalG),
});
const fmtKg = (v) => `${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;

/**
 * Perfil: ver y editar datos, objetivo, metas diarias, foto y evolución de peso.
 * La edad (calculada desde la fecha de nacimiento) y el sexo se muestran pero no se editan.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { isPremium, premiumByCode, myLink, streak } = useApp();
  const { profile, setProfile, logout, firebaseUser } = useAuth();

  const [weightHistory, setWeightHistory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFrom(profile));
  const [macrosTouched, setMacrosTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api('/history/summary');
      setWeightHistory(data.weightHistory ?? []);
    } catch (err) {
      setError(err.message);
      setWeightHistory([]);
    }
  }, []);

  useEffect(() => {
    // loadHistory es asíncrona: el estado se actualiza al llegar la respuesta.
    loadHistory();
  }, [loadHistory]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateMacro = (key, value) => { update(key, value); setMacrosTouched(true); };

  function startEdit() {
    setForm(formFrom(profile));
    setMacrosTouched(false);
    setError(null);
    setSuccess(null);
    setEditing(true);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
  }

  // ---- Guardar (PATCH /api/users/me) ----
  function buildPayload() {
    const problem = (!form.displayName.trim() && 'Escribí tu nombre.')
      || checkRange('weightKg', 'El peso', form.weightKg)
      || checkRange('heightCm', 'La altura', form.heightCm)
      || (macrosTouched && (
        checkRange('dailyCalorieGoal', 'Las calorías', form.dailyCalorieGoal, { integer: true })
        || checkRange('dailyProteinGoalG', 'Las proteínas', form.dailyProteinGoalG, { integer: true })
        || checkRange('dailyCarbsGoalG', 'Los carbohidratos', form.dailyCarbsGoalG, { integer: true })
        || checkRange('dailyFatGoalG', 'Las grasas', form.dailyFatGoalG, { integer: true })
      ));
    if (problem) return { problem };

    // Solo se mandan los campos que cambiaron: así no se recalculan metas ni se
    // suma un registro de peso si no hace falta.
    const payload = {};
    if (form.displayName.trim() !== (profile?.displayName || '')) payload.displayName = form.displayName.trim();
    ['weightKg', 'heightCm'].forEach((k) => {
      const n = toNumber(form[k]);
      if (n !== profile?.[k]) payload[k] = n;
    });
    ['activityLevel', 'goal'].forEach((k) => {
      if (form[k] && form[k] !== profile?.[k]) payload[k] = form[k];
    });
    if (macrosTouched) {
      MACROS.forEach(({ key }) => {
        const n = toNumber(form[key]);
        if (n !== profile?.[key]) payload[key] = n;
      });
    }
    return { payload };
  }

  async function save(payload) {
    setSaving(true);
    setError(null);
    try {
      const data = await api('/users/me', { method: 'PATCH', body: payload });
      setProfile(data.user);
      setEditing(false);
      setSuccess('Cambios guardados.');
      if ('weightKg' in payload || 'goal' in payload) await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    setSuccess(null);
    const { problem, payload } = buildPayload();
    if (problem) {
      setError(problem);
      return;
    }
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    if (payload.goal) {
      // Cambiar de objetivo reinicia el gráfico con el peso actual como punto de partida.
      confirm({
        title: '¿Cambiar de objetivo?',
        message: 'Tu gráfico de evolución de peso se va a reiniciar: el peso actual pasa a ser tu nuevo punto de partida. Tus metas diarias se recalculan solas.',
        confirmLabel: 'Cambiar objetivo',
        onConfirm: () => save(payload),
      });
      return;
    }
    save(payload);
  }

  // ---- Foto de perfil (PATCH /api/users/me/photo) ----
  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const type = asset.mimeType || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      setError('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
      return;
    }
    const body = new FormData();
    await appendImage(body, 'photo', asset.uri, { name: asset.fileName || `perfil.${type.split('/')[1]}`, type });
    setUploading(true);
    try {
      const data = await api('/users/me/photo', { method: 'PATCH', body });
      setProfile(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const onLogout = () =>
    confirm({
      title: 'Cerrar sesión',
      message: '¿Querés cerrar la sesión en este teléfono?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: () => { logout(); },
    });

  // ---- Datos derivados ----
  const name = profile?.displayName || firebaseUser?.displayName || 'Tu perfil';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const logs = weightHistory ?? [];
  const first = logs[0]?.weightKg;
  const last = logs[logs.length - 1]?.weightKg;
  const delta = first != null && last != null ? last - first : null;
  const goalOpt = findOption(GOAL_OPTIONS, editing ? form.goal : profile?.goal);
  const activityOpt = findOption(ACTIVITY_OPTIONS, profile?.activityLevel);
  const sexOpt = findOption(SEX_OPTIONS, profile?.sex);
  const age = displayAge(profile);

  return (
    <Screen onRefresh={editing ? undefined : loadHistory}>
      <ScreenTitle
        title="Perfil"
        right={editing ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={cancelEdit} disabled={saving} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              <Text style={styles.saveText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startEdit} style={styles.editBtn} accessibilityRole="button">
            <Pencil size={14} color={colors.primary} />
            <Text style={styles.editText}>Editar</Text>
          </Pressable>
        )}
      />

      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {/* Encabezado: foto, nombre, email */}
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View>
          <View style={styles.avatar}>
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} accessibilityLabel="Foto de perfil" />
            ) : initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <User size={30} color={colors.primary} />
            )}
          </View>
          {editing ? (
            <Pressable onPress={pickPhoto} disabled={uploading} style={styles.cameraBtn} accessibilityLabel="Cambiar foto de perfil" hitSlop={8}>
              <Camera size={14} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.email} numberOfLines={1}>{profile?.email || firebaseUser?.email || ''}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <Badge tone="light" label={isPremium ? 'NutriVision Pro' : 'Plan Gratuito'} icon={isPremium ? <Crown size={11} color="#fff" /> : null} />
            <Badge tone="light" label={`${streak} ${streak === 1 ? 'día' : 'días'}`} icon={<Flame size={11} color="#fff" />} />
          </View>
        </View>
      </LinearGradient>

      {editing ? (
        <EditForm form={form} update={update} updateMacro={updateMacro} macrosTouched={macrosTouched} age={age} sexLabel={sexOpt?.label} />
      ) : (
        <>
          {/* Peso inicial / progreso / actual */}
          <View style={styles.stats}>
            <Stat label="Peso inicial" value={first != null ? fmtKg(first) : '—'} />
            <Stat
              label="Progreso"
              value={delta != null ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg` : '—'}
              color={colors.primary}
            />
            <Stat label="Peso actual" value={last != null ? fmtKg(last) : '—'} />
          </View>

          {/* Métricas */}
          <Card>
            <SectionHeader title="Tus métricas" />
            <View style={styles.metrics}>
              <Metric Icon={Cake} label="Edad" value={age} unit="años" />
              <Metric Icon={Weight} label="Peso" value={profile?.weightKg} unit="kg" />
              <Metric Icon={Ruler} label="Altura" value={profile?.heightCm} unit="cm" />
              <Metric Icon={Users} label="Sexo" value={sexOpt?.label} />
            </View>
          </Card>

          {/* Objetivo y actividad */}
          <Card style={{ gap: 12 }}>
            <InfoRow Icon={goalOpt?.Icon || Target} label="Objetivo actual" value={goalOpt?.label ?? 'Sin definir'} hint={goalOpt?.subtitle} />
            <View style={styles.divider} />
            <InfoRow Icon={activityOpt?.Icon || TrendingUp} label="Nivel de actividad" value={activityOpt?.label ?? 'Sin definir'} hint={activityOpt?.desc} tone="water" />
          </Card>

          {/* Metas diarias */}
          <Card>
            <SectionHeader title="Metas diarias" />
            <View style={styles.goalsGrid}>
              {MACROS.map(({ key, label, unit, color, Icon }) => (
                <View key={key} style={styles.goalChip}>
                  <View style={styles.goalChipTop}>
                    <Icon size={13} color={color} />
                    <Text style={styles.goalChipLabel}>{label}</Text>
                  </View>
                  <Text style={styles.goalChipValue}>
                    {profile?.[key] ?? '—'} <Text style={styles.goalChipUnit}>{unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>Se calculan solas según tus datos y tu objetivo, pero las podés ajustar desde Editar.</Text>
          </Card>

          {/* Evolución de peso */}
          <Card>
            <SectionHeader title="Evolución de peso" />
            {weightHistory === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
            ) : logs.length > 1 ? (
              <WeightChart logs={logs} />
            ) : (
              <Text style={styles.note}>
                Todavía no hay suficientes registros para graficar tu progreso. Se suman cada vez que actualizás tu peso desde Editar.
              </Text>
            )}
          </Card>

          {/* Nutricionista */}
          <Card style={{ paddingVertical: 4 }}>
            <MenuRow
              Icon={Stethoscope}
              label="Mi nutricionista"
              hint={myLink ? myLink.nutritionist.name : 'Vinculate con el código de tu nutricionista'}
              onPress={() => router.push('/mi-nutricionista')}
            />
            <MenuRow Icon={Search} label="Buscar nutricionistas" hint="Perfiles, especialidades y valoraciones" onPress={() => router.push('/nutricionistas')} last />
          </Card>

          {/* Plan */}
          <Card style={{ paddingVertical: 4 }}>
            <MenuRow Icon={Crown} label="Plan y suscripción" hint={isPremium ? (premiumByCode ? 'NutriVision Pro (código)' : 'NutriVision Pro') : 'Gratuito'} onPress={() => router.push('/premium')} last />
          </Card>

          <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <LogOut size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </>
      )}

      {editing ? (
        <PrimaryButton label={saving ? 'Guardando…' : 'Guardar cambios'} onPress={handleSave} disabled={saving} />
      ) : null}
    </Screen>
  );
}

/* ---------------- Formulario de edición ---------------- */
function EditForm({ form, update, updateMacro, macrosTouched, age, sexLabel }) {
  return (
    <>
      <Card style={{ gap: 14 }}>
        <SectionHeader title="Datos personales" />
        <TextField label="Nombre" value={form.displayName} onChangeText={(t) => update('displayName', t)} maxLength={100} placeholder="Tu nombre" autoCapitalize="words" />
        <View style={styles.row}>
          <NumberField label="Altura" unit="cm" value={form.heightCm} onChangeText={(t) => update('heightCm', t)} style={{ flex: 1 }} />
          <NumberField label="Peso actual" unit="kg" decimal value={form.weightKg} onChangeText={(t) => update('weightKg', t)} style={{ flex: 1 }} />
        </View>
        <View style={styles.locked}>
          <Lock size={16} color={colors.inkMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lockedValue}>
              {age != null ? `${age} años` : 'Edad sin definir'} · {sexLabel ?? 'Sexo sin definir'}
            </Text>
            <Text style={styles.lockedHint}>La edad se calcula sola desde tu fecha de nacimiento. La edad y el sexo no se pueden modificar.</Text>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Objetivo" />
        {GOAL_OPTIONS.map((o) => (
          <OptionCard key={o.value} option={o} compact active={form.goal === o.value} onPress={() => update('goal', o.value)} />
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Nivel de actividad" />
        {ACTIVITY_OPTIONS.map((o) => (
          <OptionCard key={o.value} option={o} compact active={form.activityLevel === o.value} onPress={() => update('activityLevel', o.value)} />
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionHeader title="Metas diarias" />
        <Text style={styles.note}>
          {macrosTouched
            ? 'Vas a usar tus propias metas: tienen prioridad sobre el cálculo automático.'
            : 'Si cambiás tus datos u objetivo se recalculan solas. También podés escribir tus propios valores.'}
        </Text>
        <View style={styles.macroGrid}>
          {MACROS.map(({ key, label, unit }) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              value={form[key]}
              onChangeText={(t) => updateMacro(key, t)}
              placeholder={`${LIMITS[key].min}–${LIMITS[key].max}`}
              style={styles.macroCell}
            />
          ))}
        </View>
      </Card>
    </>
  );
}

/* ---------------- Piezas chicas ---------------- */
function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color && { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Metric({ Icon, label, value, unit }) {
  return (
    <View style={styles.metric}>
      <Icon size={16} color={colors.primary} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? '—'}{value != null && unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function InfoRow({ Icon, label, value, hint, tone }) {
  const water = tone === 'water';
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, water && { backgroundColor: colors.waterSoft }]}>
        <Icon size={20} color={water ? colors.water : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {hint ? <Text style={styles.infoHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function MenuRow({ Icon, label, hint, badge, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.menuRow, last && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.menuIcon}><Icon size={18} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {hint ? <Text style={styles.menuHint}>{hint}</Text> : null}
      </View>
      {badge}
      {onPress ? <ChevronRight size={18} color={colors.inkMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  editText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  ghostBtn: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  ghostText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  saveBtn: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 72, height: 72 },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.primary },
  cameraBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  name: { color: '#fff', fontSize: 19, fontWeight: '800' },
  email: { color: '#fff', opacity: 0.85, fontSize: 13 },

  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },

  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  metricLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  metricValue: { fontSize: 16, fontWeight: '800', color: colors.ink },
  metricUnit: { fontSize: 11, fontWeight: '600', color: colors.inkSoft },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  infoValue: { fontSize: 15, color: colors.ink, fontWeight: '800' },
  infoHint: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.line },

  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { width: '48%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, gap: 4 },
  goalChipTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalChipLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  goalChipValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  goalChipUnit: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17, marginTop: 8 },

  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  macroCell: { width: '47%', flexGrow: 1 },

  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  menuHint: { fontSize: 12, color: colors.inkSoft },

  locked: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 },
  lockedValue: { fontSize: 15, fontWeight: '800', color: colors.ink },
  lockedHint: { fontSize: 12, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
