import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, AtSign, BadgeCheck, ChevronRight, Link as LinkIcon, Mail, MessageCircle, Star } from 'lucide-react-native';
import { colors, radius, shadow } from '../theme';

/** Encabezado simple con botón de volver (pantallas fuera de las pestañas). */
export function BackHeader({ title, right }) {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={styles.head}>
      <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Volver">
        <ArrowLeft size={20} color={colors.ink} />
      </Pressable>
      <Text style={styles.headTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Foto del nutricionista o sus iniciales. */
export function Avatar({ uri, name, size = 52 }) {
  const initials = String(name || '?')
    .replace(/^(lic\.?|dra?\.?)\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[box, { backgroundColor: colors.bg }]} accessibilityLabel={`Foto de ${name}`} />;
  return (
    <View style={[box, styles.initials]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

/** Estrellas de solo lectura (promedio). */
export function Stars({ value = 0, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${value || 0} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} color={colors.accent} fill={value >= n - 0.25 ? colors.accent : 'transparent'} />
      ))}
    </View>
  );
}

/** Promedio + cantidad de valoraciones. */
export function RatingLine({ rating, size = 13 }) {
  if (!rating?.count) return <Text style={[styles.ratingText, { fontSize: size - 1 }]}>Sin valoraciones todavía</Text>;
  return (
    <View style={styles.ratingRow}>
      <Stars value={rating.average} size={size} />
      <Text style={[styles.ratingText, { fontSize: size - 1 }]}>
        {String(rating.average).replace('.', ',')} ({rating.count} {rating.count === 1 ? 'valoración' : 'valoraciones'})
      </Text>
    </View>
  );
}

/** Selector de 1 a 5 estrellas. */
export function StarPicker({ value, onChange, size = 34 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}>
          <Star size={size} color={colors.accent} fill={value >= n ? colors.accent : 'transparent'} />
        </Pressable>
      ))}
    </View>
  );
}

/** Tarjeta de un nutricionista del directorio. */
export function NutritionistCard({ n, onPress, highlight }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, highlight && styles.cardHighlight, pressed && { opacity: 0.85 }]}>
      <Avatar uri={n.photoUrl} name={n.name} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{n.name}</Text>
          <BadgeCheck size={15} color={colors.primary} />
        </View>
        <Text style={styles.license} numberOfLines={1}>Matrícula {n.licenseNumber}</Text>
        <RatingLine rating={n.rating} />
        {n.specialties?.length ? (
          <View style={styles.tags}>
            {n.specialties.slice(0, 3).map((s) => (
              <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
            ))}
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

export function SpecialtyTags({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.tags}>
      {items.map((s) => <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>)}
    </View>
  );
}

// ---- Contactos (fuera de la app: WhatsApp, mail, Instagram) ----
const isUrl = (v) => /^https?:\/\//i.test(v);

function contactActions(contacts) {
  if (!contacts) return [];
  const out = [];
  if (contacts.whatsapp) {
    const digits = contacts.whatsapp.replace(/\D/g, '');
    out.push({ key: 'wa', label: 'WhatsApp', value: contacts.whatsapp, Icon: MessageCircle, color: '#16A34A', url: `https://wa.me/${digits}` });
  }
  if (contacts.email) {
    out.push({ key: 'mail', label: 'Email', value: contacts.email, Icon: Mail, color: colors.water, url: `mailto:${contacts.email}` });
  }
  if (contacts.instagram) {
    const handle = contacts.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
    out.push({ key: 'ig', label: 'Instagram', value: `@${handle}`, Icon: AtSign, color: '#DB2777', url: `https://instagram.com/${handle}` });
  }
  if (contacts.other) {
    out.push({ key: 'other', label: 'Otro contacto', value: contacts.other, Icon: LinkIcon, color: colors.inkSoft, url: isUrl(contacts.other) ? contacts.other : null });
  }
  return out;
}

export function ContactList({ contacts }) {
  const actions = contactActions(contacts);
  if (!actions.length) return <Text style={styles.muted}>Este nutricionista todavía no cargó sus medios de contacto.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {actions.map(({ key, label, value, Icon, color, url }) => (
        <Pressable
          key={key}
          disabled={!url}
          onPress={() => Linking.openURL(url).catch(() => {})}
          style={({ pressed }) => [styles.contact, pressed && { opacity: 0.8 }]}
          accessibilityLabel={`${label}: ${value}`}
        >
          <View style={[styles.contactIcon, { backgroundColor: `${color}1A` }]}><Icon size={18} color={color} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.contactLabel}>{label}</Text>
            <Text style={styles.contactValue} numberOfLines={1}>{value}</Text>
          </View>
          {url ? <ChevronRight size={16} color={colors.inkMuted} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.ink },
  initials: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: colors.primaryDark, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { color: colors.inkSoft, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1.5, borderColor: 'transparent', ...shadow.card },
  cardHighlight: { borderColor: colors.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  license: { fontSize: 12, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  muted: { fontSize: 13, color: colors.inkSoft },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  contactIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  contactValue: { fontSize: 14, color: colors.ink, fontWeight: '700' },
});
