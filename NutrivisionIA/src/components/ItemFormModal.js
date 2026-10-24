import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { PrimaryButton } from './ui';
import { colors, radius } from '../theme';

/**
 * Modal reutilizable para crear/editar un ítem (heladera o lista de compras).
 * `fields`: [{ key, label, placeholder, required, maxLength }]
 */
export default function ItemFormModal({ visible, title, fields, initial, onSubmit, onClose, submitLabel = 'Guardar' }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        {/* El formulario se monta de nuevo cada vez que se abre, con los valores iniciales*/}
        {visible ? (
          <ItemForm title={title} fields={fields} initial={initial} onSubmit={onSubmit} onClose={onClose} submitLabel={submitLabel} />
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ItemForm({ title, fields, initial, onSubmit, onClose, submitLabel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? ''])));
  const [error, setError] = useState(null);

  const submit = () => {
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v).trim()]));
    const missing = fields.find((f) => f.required && !clean[f.key]);
    if (missing) {
      setError(`Completá el campo "${missing.label}".`);
      return;
    }
    onSubmit(clean);
    onClose();
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
          <X size={18} color={colors.inkSoft} />
        </Pressable>
      </View>

      {fields.map((f, i) => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.label}>{f.label}{f.required ? ' *' : ''}</Text>
          <TextInput
            value={values[f.key] ?? ''}
            onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            placeholder={f.placeholder}
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            autoFocus={i === 0}
            maxLength={f.maxLength ?? 60}
            returnKeyType={i === fields.length - 1 ? 'done' : 'next'}
            onSubmitEditing={i === fields.length - 1 ? submit : undefined}
          />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton label={submitLabel} onPress={submit} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,25,28,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 4 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 6 },
});
