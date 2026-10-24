import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { LEGAL_DOCS, LEGAL_UPDATED } from '../constants/legal';
import { colors, radius } from '../theme';

/**
 * Ventana con el texto de los Términos y Condiciones o de la Política de Privacidad.
 * `doc`: 'terms' | 'privacy' | null (cerrada).
 */
export default function LegalModal({ doc, onClose }) {
  const insets = useSafeAreaInsets();
  const content = doc ? LEGAL_DOCS[doc] : null;

  return (
    <Modal visible={Boolean(content)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{content?.title}</Text>
              <Text style={styles.updated}>Última actualización: {LEGAL_UPDATED}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} hitSlop={10} accessibilityLabel="Cerrar">
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 12 }}>
            {content?.sections.map((s) => (
              <View key={s.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                {s.body.map((p) => (
                  <Text key={p.slice(0, 40)} style={[styles.paragraph, p.startsWith('•') && styles.bullet]}>{p}</Text>
                ))}
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.okBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.okText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(23,25,28,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '88%', paddingHorizontal: 20, paddingTop: 18,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  updated: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 4 },
  section: { marginTop: 14, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  paragraph: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20 },
  bullet: { paddingLeft: 4 },
  okBtn: { marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  okText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
