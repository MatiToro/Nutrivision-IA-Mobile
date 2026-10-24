import { Platform } from 'react-native';
import { auth } from './firebase';
import { API_URL } from './config';

const DEFAULT_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(message, { status, network } = {}) {
    super(message);
    this.status = status;
    this.network = Boolean(network);
  }
}

/**
 * Cliente HTTP del backend. Adjunta el ID token de Firebase en cada request, igual que el cliente de la Web.
 */
/** `timeout` en ms: el análisis con IA (Gemini) tarda bastante más que un pedido común. */
export async function api(path, { method = 'GET', body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { Accept: 'application/json' };
  const token = await auth?.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // FormData (subida de fotos): el Content-Type multipart lo arma fetch solo.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = isForm && Platform.OS !== 'web'
      // Subida de fotos: en Expo SDK 57 el `fetch` global es el de Expo y no acepta las partes
      // { uri, name, type } de React Native ("Unsupported FormDataPart implementation").
      // XMLHttpRequest sigue usando la red nativa de React Native, que sí lee el archivo del teléfono.
      ? await xhrRequest(`${API_URL}${path}`, { method, headers, body, timeout })
      : await fetchWithTimeout(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      }, timeout);
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new ApiError('El servidor tardó demasiado en responder. Probá de nuevo.', { network: true });
    }
    throw new ApiError(
      `No pudimos conectar con el servidor (${API_URL}${path}). Revisá que el backend esté corriendo y que el celular esté en la misma red Wi-Fi. [${err?.message || 'sin detalle'}]`,
      { network: true },
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // En errores de validación (422) el backend manda el detalle de cada campo.
    const detail = Array.isArray(data?.details) && data.details[0]?.msg !== 'Invalid value' ? data.details[0]?.msg : null;
    throw new ApiError(detail || data?.error || `Error del servidor (${res.status}).`, { status: res.status });
  }
  return data;
}

function timeoutError() {
  const err = new Error('timeout');
  err.name = 'TimeoutError';
  return err;
}

async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw timeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pedido con XMLHttpRequest que devuelve un objeto con la misma forma que usa `api` ({ ok, status, json }). */
function xhrRequest(url, { method, headers, body, timeout }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = timeout;
    xhr.onload = () => resolve({
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      json: async () => JSON.parse(xhr.responseText),
    });
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.ontimeout = () => reject(timeoutError());
    xhr.send(body);
  });
}
