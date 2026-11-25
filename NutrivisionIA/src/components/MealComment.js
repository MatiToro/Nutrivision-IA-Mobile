import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCheck, MessageSquare } from 'lucide-react-native';
import { Card, PrimaryButton } from './ui';
import { Message } from './AuthUI';
import { api } from '../api/client';
import { confirm } from '../utils/confirm';
import { colors, radius } from '../theme';

/** Lo que ve el PACIENTE en el detalle de su comida. */
export function NutritionistCommentCard({ comment }) {
  if (!comment) return null;
  return (
    <Card style={styles.patientCard}>
      <View style={styles.head}>
        <View style={styles.icon}><MessageSquare size={17} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Comentario de tu nutricionista</Text>
          <Text style={styles.author}>{comment.author}</Text>
        </View>
      </View>
      <Text style={styles.text}>{comment.text}</Text>
    </Card>
  );
}

/**
 * Lo que ve el NUTRICIONISTA al abrir una comida de su paciente: escribir,
 * cambiar o borrar su comentario (uno por comida). El paciente lo ve en el
 * detalle de la comida y le aparece un aviso en Inicio.
 */
export function NutriCommentEditor({ patientId, mealId, initial, onChange }) {
  const [comment, setComment] = useState(initial || null);
  const [text, setText] = useState(initial?.text || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const base = `/nutritionist/patients/${patientId}/meals/${mealId}/comment`;

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await api(base, { method: 'PUT', body: { text: text.trim() } });
      setComment(data.comment);
      setDone('Comentario guardado. Le va a aparecer un aviso al paciente.');
      onChange?.(data.comment);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = () => confirm({
    title: 'Borrar comentario',
    message: 'El paciente deja de verlo.',
    confirmLabel: 'Borrar',
    onConfirm: async () => {
      setError(null);
      setDone(null);
      try {
        await api(base, { method: 'DELETE' });
        setComment(null);
        setText('');
        onChange?.(null);
      } catch (err) {
        setError(err.message);
      }
    },
  });

  const unchanged = comment && text.trim() === comment.text;
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.headPlain}>
        <MessageSquare size={17} color={colors.primary} />
        <Text style={styles.titleDark}>{comment ? 'Tu comentario' : 'Dejale un comentario'}</Text>
      </View>
      <Text style={styles.hint}>El paciente lo ve en el detalle de esta comida y le llega un aviso en su Inicio.</Text>
      {comment?.seenAt ? (
        <View style={styles.seen}>
          <CheckCheck size={14} color={colors.primary} />
          <Text style={styles.seenText}>Visto el {new Date(comment.seenAt).toLocaleDateString('es-AR')}</Text>
        </View>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Ej: ¡Muy bien la porción de verduras! Sumale una proteína."
        placeholderTextColor={colors.inkMuted}
        multiline
        maxLength={500}
        style={styles.input}
      />
      {error ? <Message>{error}</Message> : null}
      {done ? <Message tone="info">{done}</Message> : null}
      <PrimaryButton
        label={busy ? 'Guardando…' : comment ? 'Guardar cambios' : 'Enviar comentario'}
        onPress={save}
        disabled={busy || !text.trim() || unchanged}
      />
      {comment ? <PrimaryButton label="Borrar comentario" variant="ghost" onPress={remove} disabled={busy} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  patientCard: { gap: 10, backgroundColor: colors.primarySoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headPlain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  titleDark: { fontSize: 16, fontWeight: '800', color: colors.ink },
  author: { fontSize: 12, color: colors.inkSoft },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  seen: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seenText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  input: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.ink, minHeight: 80, textAlignVertical: 'top',
  },
});
