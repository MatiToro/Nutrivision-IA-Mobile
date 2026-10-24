import { Platform } from 'react-native';

/**
 * Agrega una imagen local a un FormData para subirla al backend.
 */
export async function appendImage(form, field, uri, { name = 'plato.jpg', type = 'image/jpeg' } = {}) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
    return;
  }
  // Android necesita la ruta con el esquema file:// para poder leer el archivo al subirlo.
  const fileUri = uri.startsWith('/') ? `file://${uri}` : uri;
  form.append(field, { uri: fileUri, name, type });
}
