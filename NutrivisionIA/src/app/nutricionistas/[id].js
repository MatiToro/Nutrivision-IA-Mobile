import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Crown, Lock, MessageSquareText, UserRoundCheck } from 'lucide-react-native';
import { Badge, Card, PrimaryButton, Screen, SectionHeader } from '../../components/ui';
import { Message } from '../../components/AuthUI';
import { Avatar, BackHeader, ContactList, RatingLine, SpecialtyTags, StarPicker, Stars } from '../../components/Nutritionist';
import { api } from '../../api/client';
import { colors, radius } from '../../theme';

const shortDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Perfil público del nutricionista: datos, contacto (solo Premium) y valoraciones. */
export default function NutritionistProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api(`/nutritionists/${id}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  // Se recarga al volver (ej. después de pasarse a Pro, para mostrar los contactos).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const n = data?.nutritionist;

  return (
    <Screen onRefresh={load}>
      <BackHeader title="Nutricionista" />

      {error ? <Message>{error}</Message> : null}
      {!data && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {n ? (
        <>
          <Card style={styles.hero}>
            <Avatar uri={n.photoUrl} name={n.name} size={84} />
            <View style={styles.nameRow}>
              <Text style={styles.name}>{n.name}</Text>
              <BadgeCheck size={18} color={colors.primary} />
            </View>
            <Text style={styles.license}>Matrícula {n.licenseNumber} · verificada</Text>
            <RatingLine rating={n.rating} size={15} />
            {data.link === 'ACTIVE' ? (
              <Badge label="Tu nutricionista" icon={<UserRoundCheck size={12} color={colors.primaryDark} />} />
            ) : null}
            <SpecialtyTags items={n.specialties} />
          </Card>

          {n.bio ? (
            <Card>
              <SectionHeader title="Sobre mí" />
              <Text style={styles.bio}>{n.bio}</Text>
            </Card>
          ) : null}

          {/* Contacto: el backend solo manda los datos a usuarios Premium */}
          <Card>
            <SectionHeader title="Contacto" />
            {n.contacts ? (
              <ContactList contacts={n.contacts} />
            ) : (
              <View style={styles.locked}>
                <View style={styles.lockIcon}><Lock size={20} color={colors.accent} /></View>
                <Text style={styles.lockTitle}>Contacto exclusivo de NutriVision Pro</Text>
                <Text style={styles.lockText}>
                  Pasate a Pro para ver el WhatsApp, el mail y las redes de este nutricionista y coordinar tu consulta.
                </Text>
                <PrimaryButton label="Ver NutriVision Pro" icon={<Crown size={18} color="#fff" />} onPress={() => router.push('/premium')} style={{ alignSelf: 'stretch' }} />
              </View>
            )}
          </Card>

          {data.canReview ? (
            <ReviewForm nutritionistId={n.id} initial={data.myReview} onSaved={load} />
          ) : null}

          <Card>
            <SectionHeader title={`Valoraciones${n.rating?.count ? ` (${n.rating.count})` : ''}`} />
            {n.reviews.length === 0 ? (
              <Text style={styles.muted}>
                Todavía nadie lo valoró. Solo pueden valorar los pacientes que estén o hayan estado vinculados.
              </Text>
            ) : (
              n.reviews.map((r, i) => (
                <View key={r.id} style={[styles.review, i === n.reviews.length - 1 && { borderBottomWidth: 0 }]}>
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
        </>
      ) : null}
    </Screen>
  );
}

/** Crear o editar la propia valoración. Se puede editar aunque ya no esté vinculado. */
function ReviewForm({ nutritionistId, initial, onSaved }) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save() {
    if (!stars) {
      setMsg({ tone: 'error', text: 'Elegí de 1 a 5 estrellas.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api(`/nutritionists/${nutritionistId}/review`, { method: 'PUT', body: { stars, comment: comment.trim() || null } });
      setMsg({ tone: 'success', text: initial ? 'Actualizaste tu valoración.' : '¡Gracias por tu valoración!' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.formHead}>
        <MessageSquareText size={18} color={colors.primary} />
        <Text style={styles.formTitle}>{initial ? 'Tu valoración' : 'Valorá a tu nutricionista'}</Text>
      </View>
      <StarPicker value={stars} onChange={setStars} />
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Contá tu experiencia (opcional)"
        placeholderTextColor={colors.inkMuted}
        style={styles.comment}
        multiline
        maxLength={500}
      />
      {msg ? <Message tone={msg.tone}>{msg.text}</Message> : null}
      <PrimaryButton label={saving ? 'Guardando…' : initial ? 'Actualizar valoración' : 'Enviar valoración'} onPress={save} disabled={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center', flexShrink: 1 },
  license: { fontSize: 13, color: colors.inkSoft },
  bio: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  lockIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  lockText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 19, marginBottom: 6 },
  muted: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  review: { gap: 5, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: colors.ink },
  reviewDate: { fontSize: 12, color: colors.inkMuted },
  reviewText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  comment: {
    minHeight: 80, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12,
    fontSize: 14, color: colors.ink, textAlignVertical: 'top',
  },
});
