import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lock, Plus, X } from 'lucide-react-native';
import { TextField } from './Form';
import { colors, radius } from '../theme';

// Sugerencias para cargar especialidades con un toque (también se pueden escribir).
const SUGGESTED = [
  'Deportiva', 'Descenso de peso', 'Vegetariana y vegana', 'Clínica', 'Pediátrica',
  'Diabetes', 'Trastornos alimentarios', 'Embarazo y lactancia', 'Celiaquía',
];
const MAX_SPECIALTIES = 8;

/** Estado inicial del formulario a partir del perfil guardado. */
export function formFromProfile(profile, displayName) {
  return {
    displayName: displayName || '',
    licenseNumber: profile?.licenseNumber || '',
    bio: profile?.bio || '',
    specialties: profile?.specialties || [],
    contactWhatsapp: profile?.contactWhatsapp || '',
    contactEmail: profile?.contactEmail || '',
    contactInstagram: profile?.contactInstagram || '',
    contactOther: profile?.contactOther || '',
  };
}

/** Validación local (el backend vuelve a validar todo). */
export function validateNutriForm(form, { withLicense }) {
  if (form.displayName.trim().length < 3) return 'Escribí tu nombre profesional.';
  if (withLicense && form.licenseNumber.trim().length < 3) return 'Ingresá tu número de matrícula.';
  if (!form.specialties.length) return 'Agregá al menos una especialidad.';
  const hasContact = ['contactWhatsapp', 'contactEmail', 'contactInstagram', 'contactOther'].some((k) => form[k].trim());
  if (!hasContact) return 'Cargá al menos un medio de contacto para que tus pacientes puedan escribirte.';
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return 'El correo de contacto no es válido.';
  if (form.contactWhatsapp.trim() && !/^\+?[\d\s()-]{6,24}$/.test(form.contactWhatsapp.trim())) return 'El WhatsApp tiene que ser un número de teléfono (con código de área).';
  return null;
}

/** Cuerpo para el backend. */
export function nutriFormBody(form, { withLicense }) {
  return {
    displayName: form.displayName.trim(),
    ...(withLicense && { licenseNumber: form.licenseNumber.trim() }),
    bio: form.bio.trim(),
    specialties: form.specialties,
    contactWhatsapp: form.contactWhatsapp.trim(),
    contactEmail: form.contactEmail.trim(),
    contactInstagram: form.contactInstagram.trim(),
    contactOther: form.contactOther.trim(),
  };
}

/** Campos del perfil profesional (solicitud y edición). */
export function NutriProfileFields({ form, update, licenseEditable = true }) {
  return (
    <View style={{ gap: 14 }}>
      <TextField
        label="Nombre profesional"
        value={form.displayName}
        onChangeText={(t) => update('displayName', t)}
        placeholder="Ej: Lic. Ana Pérez"
        maxLength={100}
        autoCapitalize="words"
      />
      {licenseEditable ? (
        <TextField
          label="Matrícula profesional"
          value={form.licenseNumber}
          onChangeText={(t) => update('licenseNumber', t)}
          placeholder="Ej: MN 12345"
          maxLength={30}
          autoCapitalize="characters"
        />
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Matrícula profesional</Text>
          <View style={styles.locked}>
            <Text style={styles.lockedText}>{form.licenseNumber}</Text>
            <Lock size={14} color={colors.inkMuted} />
          </View>
          <Text style={styles.hint}>Verificada por un administrador. No se puede cambiar.</Text>
        </View>
      )}
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Sobre vos</Text>
        <TextInput
          value={form.bio}
          onChangeText={(t) => update('bio', t)}
          placeholder="Contá tu experiencia, cómo trabajás y si atendés online o presencial."
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={1000}
          style={styles.bio}
        />
        <Text style={styles.hint}>{form.bio.length}/1000</Text>
      </View>
      <SpecialtiesInput value={form.specialties} onChange={(v) => update('specialties', v)} />

      <View style={{ gap: 4 }}>
        <Text style={styles.section}>Contacto</Text>
        <Text style={styles.hint}>
          Lo ven solo los usuarios NutriVision Pro. Cargá al menos uno: el contacto con tus pacientes es por fuera de la app.
        </Text>
      </View>
      <TextField
        label="WhatsApp"
        value={form.contactWhatsapp}
        onChangeText={(t) => update('contactWhatsapp', t)}
        placeholder="+54 9 11 1234-5678"
        keyboardType="phone-pad"
        maxLength={24}
      />
      <TextField
        label="Correo de contacto"
        value={form.contactEmail}
        onChangeText={(t) => update('contactEmail', t)}
        placeholder="consultas@ejemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={120}
      />
      <TextField
        label="Instagram"
        value={form.contactInstagram}
        onChangeText={(t) => update('contactInstagram', t)}
        placeholder="@tu.usuario"
        autoCapitalize="none"
        maxLength={60}
      />
      <TextField
        label="Otro (web, consultorio, etc.)"
        value={form.contactOther}
        onChangeText={(t) => update('contactOther', t)}
        placeholder="https://… o dirección del consultorio"
        autoCapitalize="none"
        maxLength={200}
      />
    </View>
  );
}

function SpecialtiesInput({ value, onChange }) {
  const [text, setText] = useState('');
  const full = value.length >= MAX_SPECIALTIES;
  const add = (raw) => {
    const s = raw.trim();
    if (s.length < 2 || full || value.some((v) => v.toLowerCase() === s.toLowerCase())) return;
    onChange([...value, s.slice(0, 40)]);
    setText('');
  };
  const remove = (s) => onChange(value.filter((v) => v !== s));
  const suggestions = SUGGESTED.filter((s) => !value.includes(s));

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Especialidades</Text>
      {value.length ? (
        <View style={styles.chips}>
          {value.map((s) => (
            <Pressable key={s} onPress={() => remove(s)} style={styles.chipOn} accessibilityLabel={`Quitar ${s}`}>
              <Text style={styles.chipOnText}>{s}</Text>
              <X size={13} color="#fff" />
            </Pressable>
          ))}
        </View>
      ) : null}
      {!full ? (
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribí una especialidad"
            placeholderTextColor={colors.inkMuted}
            style={styles.addInput}
            maxLength={40}
            onSubmitEditing={() => add(text)}
            returnKeyType="done"
          />
          <Pressable onPress={() => add(text)} style={[styles.addBtn, text.trim().length < 2 && { opacity: 0.5 }]} disabled={text.trim().length < 2} accessibilityLabel="Agregar especialidad">
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Máximo {MAX_SPECIALTIES} especialidades.</Text>
      )}
      {!full && suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={styles.chip}>
              <Plus size={12} color={colors.primary} />
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkMuted, lineHeight: 17 },
  locked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg,
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  lockedText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  bio: {
    minHeight: 110, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: 12,
    fontSize: 15, color: colors.ink, textAlignVertical: 'top', backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipOn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.primary },
  chipOnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1, minWidth: 0, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
  },
  addBtn: { width: 46, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
