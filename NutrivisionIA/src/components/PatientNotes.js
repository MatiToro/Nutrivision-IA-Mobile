import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lock, Pencil, StickyNote, Trash2 } from 'lucide-react-native';
import { Card, PrimaryButton } from './ui';
import { Message } from './AuthUI';
import { api } from '../api/client';
import { confirm } from '../utils/confirm';
import { colors, radius } from '../theme';

const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Notas privadas del nutricionista sobre un paciente (ficha del paciente).
 * Solo las ve el nutricionista: el paciente nunca recibe estos datos.
 */
export default function PatientNotes({ patientId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes || []);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/nutritionist/patients/${patientId}/notes`, { method: 'POST', body: { text } });
      setNotes((list) => [data.note, ...list]);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/nutritionist/patients/${patientId}/notes/${id}`, { method: 'PATCH', body: { text } });
      setNotes((list) => list.map((n) => (n.id === id ? data.note : n)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = (id) => confirm({
    title: 'Borrar nota',
    message: 'La nota se borra para siempre.',
    confirmLabel: 'Borrar',
    onConfirm: async () => {
      setError(null);
      try {
        await api(`/nutritionist/patients/${patientId}/notes/${id}`, { method: 'DELETE' });
        setNotes((list) => list.filter((n) => n.id !== id));
      } catch (err) {
        setError(err.message);
      }
    },
  });

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <StickyNote size={17} color={colors.primary} />
        <Text style={styles.title}>Notas privadas</Text>
      </View>
      <View style={styles.privacy}>
        <Lock size={12} color={colors.inkSoft} />
        <Text style={styles.hint}>Solo las ves vos: el paciente no tiene acceso.</Text>
      </View>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Ej: Consulta 12/11: le cuesta desayunar, probar avena."
        placeholderTextColor={colors.inkMuted}
        multiline
        maxLength={2000}
        style={styles.input}
      />
      <PrimaryButton label={busy && !editingId ? 'Guardando…' : 'Agregar nota'} onPress={add} disabled={busy || !draft.trim()} />
      {error ? <Message>{error}</Message> : null}

      {notes.length === 0 ? <Text style={styles.hint}>Todavía no escribiste notas sobre este paciente.</Text> : null}
      {notes.map((n) => (
        <View key={n.id} style={styles.note}>
          {editingId === n.id ? (
            <>
              <TextInput value={editText} onChangeText={setEditText} multiline maxLength={2000} style={styles.input} autoFocus />
              <View style={styles.actions}>
                <Pressable onPress={() => setEditingId(null)} style={styles.ghostBtn}><Text style={styles.ghostText}>Cancelar</Text></Pressable>
                <Pressable onPress={() => saveEdit(n.id)} disabled={busy || !editText.trim()} style={[styles.okBtn, (busy || !editText.trim()) && { opacity: 0.5 }]}>
                  <Text style={styles.okText}>{busy ? 'Guardando…' : 'Guardar'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.noteText}>{n.text}</Text>
              <View style={styles.noteFoot}>
                <Text style={styles.date}>
                  {fmtDate(n.createdAt)}{new Date(n.updatedAt) - new Date(n.createdAt) > 60000 ? ' · editada' : ''}
                </Text>
                <Pressable onPress={() => { setEditingId(n.id); setEditText(n.text); }} hitSlop={8} accessibilityLabel="Editar nota">
                  <Pencil size={15} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => remove(n.id)} hitSlop={8} accessibilityLabel="Borrar nota">
                  <Trash2 size={15} color={colors.danger} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  input: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.ink, minHeight: 70, textAlignVertical: 'top',
  },
  note: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 6 },
  noteText: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  noteFoot: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  date: { flex: 1, fontSize: 11, color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  ghostBtn: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: colors.line },
  ghostText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  okBtn: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary },
  okText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
