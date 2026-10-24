import { Platform } from 'react-native';

/**
 * Inicio de sesión con Google en Android (librería nativa
 * @react-native-google-signin/google-signin, versión gratuita).
 *
 * Flujo: Google muestra el selector de cuentas → devuelve un idToken →
 * con ese token se inicia sesión en Firebase (signInWithCredential), igual
 * que en la Web. El backend sigue recibiendo el token de Firebase de siempre.
 *
 * Es código nativo: funciona en el APK (EAS Build), no en Expo Go ni en la
 * versión web de Expo. Ahí el botón avisa en vez de romper la app.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let lib = null;
let configured = false;

function loadLib() {
  if (lib !== null) return lib;
  if (Platform.OS === 'web') {
    lib = false;
    return lib;
  }
  try {

    lib = require('@react-native-google-signin/google-signin');
  } catch {
    lib = false;
  }
  return lib;
}

function notAvailable(message) {
  const err = new Error(message);
  err.code = 'google/not-available';
  return err;
}

/**
 * Abre el selector de cuentas de Google y devuelve el idToken.
 * Devuelve null si el usuario cerró el selector sin elegir cuenta.
 */
export async function getGoogleIdToken() {
  const g = loadLib();
  if (!g || !g.GoogleSignin) {
    throw notAvailable('El inicio con Google funciona en la app instalada (APK). En Expo Go usá tu correo y contraseña.');
  }
  if (!WEB_CLIENT_ID) {
    throw notAvailable('Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  const { GoogleSignin, isSuccessResponse } = g;
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    // Versiones anteriores avisan la cancelación con un error.
    if (err?.code && err.code === g.statusCodes?.SIGN_IN_CANCELLED) return null;
    throw err;
  }
  // Versiones nuevas: { type: 'success' | 'cancelled', data }.
  if (isSuccessResponse ? !isSuccessResponse(response) : !response?.data) return null;
  const idToken = response.data?.idToken;
  if (!idToken) throw notAvailable('Google no devolvió el token de acceso. Probá de nuevo.');
  return idToken;
}

/** Cierra la sesión de Google en el teléfono (así la próxima vez vuelve a preguntar la cuenta). */
export async function googleSignOut() {
  const g = loadLib();
  if (!g || !g.GoogleSignin || !configured) return;
  try {
    await g.GoogleSignin.signOut();
  } catch {
    // No es crítico: la sesión de la app ya se cerró en Firebase.
  }
}

/** Traduce los errores de Google Sign-In a mensajes en español (o null si no es de Google). */
export function googleErrorMessage(err) {
  const g = loadLib();
  const codes = (g && g.statusCodes) || {};
  const code = err?.code;
  if (code === 'google/not-available') return err.message;
  if (code && code === codes.IN_PROGRESS) return 'Ya se está iniciando sesión con Google.';
  if (code && code === codes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Este teléfono no tiene Google Play Services actualizado.';
  }
  if (String(code) === '10' || /DEVELOPER_ERROR/i.test(err?.message || '')) {
    return 'Google rechazó la configuración de la app (SHA-1 o ID de cliente). Revisá la configuración en Firebase.';
  }
  return null;
}
