import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BadgeCheck, Camera, Eye, EyeOff, LogOut, Pencil, Users } from 'lucide-react-native';
import { Badge, Card, PrimaryButton, Screen, ScreenTitle, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { ContactList, RatingLine, SpecialtyTags, Stars } from '../../components/Nutritionist';
import { NutriProfileFields, formFromProfile, nutriFormBody, validateNutriForm } from '../../components/NutriForm';
import { useAuth } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';
import { api } from '../../api/client';
import { appendImage } from '../../utils/formImage';
import { confirm } from '../../utils/confirm';
import { colors, gradients, radius, shadow } from '../../theme';

const shortDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Perfil profesional público del nutricionista: datos, contactos y valoraciones recibidas. */
export default function NutriProfileScreen() {
  const { profile: user, setProfile, logout } = useAuth();
  const { data, apply, refresh } = useNutri();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviews, setReviews] = useState(null);

  const profile = data?.profile;
  const listed = data?.subscription?.active;

  const loadReviews = useCallback(async () => {
    try {
      const res = await api('/nutritionist/me/reviews');
      setReviews(res.reviews);
    } catch {
      setReviews([]);
    }
  }, []);
  useFocusEffect(useCallback(() => { loadReviews(); }, [loadReviews]));

  const update = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };

  const startEdit = () => {
    setForm(formFromProfile(profile, user?.displayName));
    setEditing(true);
    setSuccess(null);
    setError(null);
  };

  async function save() {
    const problem = validateNutriForm(form, { withLicense: false });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const res = await api('/nutritionist/me/profile', { method: 'PATCH', body: nutriFormBody(form, { withLicense: false }) });
      apply(res);
      setEditing(false);
      setSuccess('Perfil actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
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
      const res = await api('/users/me/photo', { method: 'PATCH', body });
      setProfile(res.user);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const onLogout = () => confirm({
    title: 'Cerrar sesión',
    message: '¿Querés cerrar la sesión en este teléfono?',
    confirmLabel: 'Cerrar sesión',
    onConfirm: () => { logout(); },
  });

  if (!profile) return null;
  const name = user?.displayName || 'Tu perfil';
  const initials = name.replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const contacts = {
    whatsapp: profile.contactWhatsapp, email: profile.contactEmail, instagram: profile.contactInstagram, other: profile.contactOther,
  };

  return (
    <Screen onRefresh={async () => { await Promise.all([refresh(), loadReviews()]); }}>
      <ScreenTitle
        title="Mi perfil"
        subtitle="Así te ven los usuarios en el directorio."
        right={!editing ? (
          <Pressable onPress={startEdit} style={styles.editBtn} accessibilityRole="button">
            <Pencil size={16} color={colors.primary} />
            <Text style={styles.editText}>Editar</Text>
          </Pressable>
        ) : null}
      />

      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.initials}>{initials}</Text></View>
          )}
          <Pressable onPress={pickPhoto} disabled={uploading} style={styles.cameraBtn} accessibilityLabel="Cambiar foto" hitSlop={8}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={14} color="#fff" />}
          </Pressable>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <BadgeCheck size={16} color="#fff" />
          </View>
          <Text style={styles.license}>Matrícula {profile.licenseNumber}</Text>
          <View style={styles.badges}>
            <Badge tone="light" label={listed ? 'Visible en el directorio' : 'Oculto del directorio'} icon={listed ? <Eye size={11} color="#fff" /> : <EyeOff size={11} color="#fff" />} />
            <Badge tone="light" label={`${data.stats.activePatients} ${data.stats.activePatients === 1 ? 'paciente' : 'pacientes'}`} icon={<Users size={11} color="#fff" />} />
          </View>
        </View>
      </LinearGradient>

      {success ? <Message tone="success">{success}</Message> : null}
      {error ? <Message>{error}</Message> : null}

      {editing ? (
        <>
          <Card><NutriProfileFields form={form} update={update} licenseEditable={false} /></Card>
          <View style={styles.actions}>
            <PrimaryButton variant="ghost" label="Cancelar" onPress={() => { setEditing(false); setError(null); }} disabled={saving} style={{ flex: 1 }} />
            <PrimaryButton label={saving ? 'Guardando…' : 'Guardar'} onPress={save} disabled={saving} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <Card style={{ gap: 8 }}>
            <SectionHeader title="Valoración" />
            <RatingLine rating={data.stats.rating} size={16} />
          </Card>

          <Card style={{ gap: 8 }}>
            <SectionHeader title="Sobre mí" />
            <Text style={styles.bio}>{profile.bio || 'Todavía no escribiste tu descripción.'}</Text>
            <SpecialtyTags items={profile.specialties} />
          </Card>

          <Card style={{ gap: 8 }}>
            <SectionHeader title="Contacto" />
            <Text style={styles.note}>Lo ven solo los usuarios NutriVision Pro.</Text>
            <ContactList contacts={contacts} />
          </Card>

          <Card>
            <SectionHeader title={`Valoraciones recibidas${reviews?.length ? ` (${reviews.length})` : ''}`} />
            {reviews === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
            ) : reviews.length === 0 ? (
              <Text style={styles.note}>Todavía no recibiste valoraciones. Las dejan tus pacientes actuales o anteriores.</Text>
            ) : (
              reviews.map((r, i) => (
                <View key={r.id} style={[styles.review, i === reviews.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                    <Text style={styles.reviewDate}>{shortDate(r.updatedAt)}</Text>
                  </View>
                  <Stars value={r.stars} size={13} />
                  {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
                </View>
              ))
            )}
          </Card>

          <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <LogOut size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  editText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18, ...shadow.card },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  avatarEmpty: { backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontSize: 24, fontWeight: '800' },
  cameraBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  license: { color: '#fff', opacity: 0.9, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bio: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10 },
  review: { gap: 5, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: colors.ink },
  reviewDate: { fontSize: 12, color: colors.inkMuted },
  reviewText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: radius.md, backgroundColor: colors.dangerSoft,
  },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
