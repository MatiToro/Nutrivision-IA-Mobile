import { Platform } from 'react-native';

/**
 * Anuncios del plan Gratuito con Google AdMob
 * (librería react-native-google-mobile-ads).
 *
 * - Por ahora se usan los ANUNCIOS DE PRUEBA oficiales de Google (dicen "Test Ad"):
 *   funcionan sin cuenta de AdMob y no hay riesgo de que suspendan la cuenta por
 *   clics durante las pruebas o la presentación. Para pasar a anuncios reales:
 *   poner USE_TEST_ADS = false, cargar los IDs de AdMob abajo y el App ID en app.json.
 * - Se piden anuncios NO personalizados (no se usa el historial del usuario).
 */
const USE_TEST_ADS = true;

// IDs reales de AdMob (Anuncios → Bloques de anuncios). Solo se usan si USE_TEST_ADS = false.
const REAL_UNIT_IDS = {
  banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

// Intersticial: como mucho uno cada 3 minutos.
const INTERSTITIAL_MIN_GAP_MS = 3 * 60 * 1000;

export const AD_REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };

let lib = null;
function loadLib() {
  if (lib !== null) return lib;
  if (Platform.OS === 'web') {
    lib = false;
    return lib;
  }
  try {
    lib = require('react-native-google-mobile-ads');
  } catch {
    lib = false;
  }
  return lib;
}

/** Devuelve la librería de anuncios, o null si no está disponible en este entorno. */
export function getAdsLib() {
  const g = loadLib();
  return g && g.BannerAd ? g : null;
}

export function unitId(kind) {
  const g = getAdsLib();
  if (!g) return null;
  if (USE_TEST_ADS) return kind === 'banner' ? g.TestIds.ADAPTIVE_BANNER : g.TestIds.INTERSTITIAL;
  return REAL_UNIT_IDS[kind];
}

let initPromise = null;
/** Inicializa AdMob una sola vez (al abrir la app). */
export function initAds() {
  const g = getAdsLib();
  if (!g) return Promise.resolve(false);
  if (!initPromise) {
    initPromise = g.default()
      .initialize()
      .then(() => true)
      .catch(() => false);
  }
  return initPromise;
}

// ---------- Intersticial ----------
let interstitial = null;
let interstitialLoaded = false;
let lastShownAt = 0;

/** Precarga el intersticial (así está listo cuando termina la acción del usuario). */
export function preloadInterstitial() {
  const g = getAdsLib();
  if (!g) return;
  if (!interstitial) {
    interstitial = g.InterstitialAd.createForAdRequest(unitId('interstitial'), AD_REQUEST_OPTIONS);
    interstitial.addAdEventListener(g.AdEventType.LOADED, () => { interstitialLoaded = true; });
    interstitial.addAdEventListener(g.AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      interstitial.load();
    });
    interstitial.addAdEventListener(g.AdEventType.ERROR, () => { interstitialLoaded = false; });
  }
  if (!interstitialLoaded) {
    initAds().then((ok) => { if (ok) interstitial.load(); });
  }
}

/**
 * Muestra el intersticial si está cargado y pasaron 3 minutos desde el último.
 * Se llama DESPUÉS de que la acción terminó (ej. comida ya guardada), nunca en el medio.
 */
export function showInterstitialIfReady() {
  if (!interstitial || !interstitialLoaded) return false;
  if (Date.now() - lastShownAt < INTERSTITIAL_MIN_GAP_MS) return false;
  lastShownAt = Date.now();
  interstitialLoaded = false;
  interstitial.show().catch(() => {});
  return true;
}
