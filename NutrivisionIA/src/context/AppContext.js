import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey } from '../utils/dates';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { uuid } from '../utils/uuid';

/**
 * Estado global de la app mobile.
 *
 * - profile / comidas de hoy / racha / plan: vienen del backend
 *   (POST /auth/session, GET /history/summary, GET /history/meals, GET /plan).
 *   Si todavía no cargaron, quedan vacíos: nunca se muestran datos inventados.
 * - fridge / shopping (Mi cocina): se guardan en el servidor
 *   (/api/kitchen), así no se pierden al cambiar de teléfono. Los cambios se
 *   ven al instante y, si el servidor falla, se vuelve a cargar lo guardado.
 * - water: por ahora se guarda en el dispositivo (AsyncStorage).
 */

const STORAGE = {
  water: 'nv:water',
  legacyFridge: 'nv:fridge',
  legacyShopping: 'nv:shopping',
};

// Mismos topes que valida el backend.
const NAME_MAX = 60;
const QTY_MAX = 30;
const cut = (v, max) => String(v ?? '').trim().slice(0, max);

// Límite del plan Gratuito. El valor real lo manda el backend (GET /api/plan);
// esta constante solo se usa mientras esa respuesta no llegó.
export const FREE_DAILY_SCAN_LIMIT = 3;
export const WATER_GLASS_ML = 250;
export const WATER_GOAL_GLASSES = 8; // 2 L, meta sugerida por defecto

const AppContext = createContext(null);

async function load(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [waterByDay, setWaterByDay] = useState({});
  const [fridge, setFridge] = useState([]);
  const [shopping, setShopping] = useState([]);
  // Estado de la cocina en el servidor: 'idle' | 'loading' | 'ready' | 'error'
  const [kitchenStatus, setKitchenStatus] = useState('idle');
  const [kitchenError, setKitchenError] = useState(null);
  // Aviso breve, ej. "Ya tenías Huevos: se sumó la cantidad" (se oculta solo).
  const [kitchenNotice, setKitchenNotice] = useState(null);
  const noticeTimer = useRef(null);
  const showKitchenNotice = useCallback((text) => {
    clearTimeout(noticeTimer.current);
    setKitchenNotice(text);
    noticeTimer.current = setTimeout(() => setKitchenNotice(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // ---- Datos del backend ----
  const { profile } = useAuth();
  const [meals, setMeals] = useState([]); // comidas de hoy
  const [streak, setStreak] = useState(0);
  const [planInfo, setPlanInfo] = useState(null);
  const [dataError, setDataError] = useState(null);
  const plan = profile?.plan ?? 'FREE';
  // Nutricionista vinculado (null = sin vínculo, undefined = todavía no se sabe)
  const [myLink, setMyLink] = useState(undefined);
  const isPatient = !profile?.role || profile.role === 'USER';

  const refreshData = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const [summary, today, planRes] = await Promise.all([
        api('/history/summary'),
        api(`/history/meals?from=${encodeURIComponent(start.toISOString())}`),
        api('/plan'),
      ]);
      setStreak(summary.streak ?? 0);
      setMeals(today.meals ?? []);
      setPlanInfo(planRes);
      setDataError(null);
    } catch (err) {
      setDataError(err.message);
    }
  }, []);

  /** Vínculo con el nutricionista. Si falla, no rompe el resto de la app. */
  const refreshLink = useCallback(async () => {
    try {
      const data = await api('/links/me');
      setMyLink(data.link ?? null);
      return data.link ?? null;
    } catch {
      setMyLink(null);
      return null;
    }
  }, []);

  /** Comidas de un rango de fechas (para el Historial). */
  const fetchMeals = useCallback(async (from, to) => {
    const qs = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    const data = await api(`/history/meals?${qs}`);
    return data.meals ?? [];
  }, []);

  const profileId = profile?.id;
  useEffect(() => {
    if (profileId && isPatient) refreshData();
  }, [profileId, isPatient, refreshData]);

  useEffect(() => {
    if (profileId && isPatient) refreshLink();
  }, [profileId, isPatient, refreshLink]);

  useEffect(() => {
    (async () => {
      setWaterByDay(await load(STORAGE.water, {}));
      setReady(true);
    })();
  }, []);

  // Persistencia automática del agua
  useEffect(() => { if (ready) save(STORAGE.water, waterByDay); }, [ready, waterByDay]);

  // ---- Mi cocina en el servidor ----
  const applyKitchen = useCallback((data) => {
    setFridge(data.fridge ?? []);
    setShopping(data.shopping ?? []);
    setKitchenStatus('ready');
  }, []);

  /** Si en el teléfono quedaron datos de la versión anterior, los pasa a la cuenta una sola vez. */
  const importLegacyKitchen = useCallback(async () => {
    const [oldFridge, oldShopping] = await Promise.all([load(STORAGE.legacyFridge, []), load(STORAGE.legacyShopping, [])]);
    const toItems = (list, withDone) => (Array.isArray(list) ? list : [])
      .filter((it) => cut(it?.name, NAME_MAX))
      .slice(0, 200)
      .map((it) => ({
        name: cut(it.name, NAME_MAX),
        quantity: cut(it.quantity, QTY_MAX),
        ...(withDone ? { done: it.done === true } : {}),
      }));
    const fridgeItems = toItems(oldFridge, false);
    const shoppingItems = toItems(oldShopping, true);
    if (!fridgeItems.length && !shoppingItems.length) {
      AsyncStorage.multiRemove([STORAGE.legacyFridge, STORAGE.legacyShopping]).catch(() => {});
      return null;
    }
    const data = await api('/kitchen/import', { method: 'POST', body: { fridge: fridgeItems, shopping: shoppingItems } });
    // Recién cuando el servidor los guardó se borran del teléfono.
    await AsyncStorage.multiRemove([STORAGE.legacyFridge, STORAGE.legacyShopping]).catch(() => {});
    return data;
  }, []);

  const refreshKitchen = useCallback(async () => {
    setKitchenStatus((st) => (st === 'ready' ? st : 'loading'));
    try {
      let data = null;
      try {
        data = await importLegacyKitchen();
      } catch {
        // Si falla la importación, los datos viejos quedan en el teléfono y se reintenta la próxima vez.
      }
      applyKitchen(data ?? await api('/kitchen'));
      setKitchenError(null);
    } catch (err) {
      setKitchenError(err.message);
      setKitchenStatus((st) => (st === 'ready' ? st : 'error'));
    }
  }, [applyKitchen, importLegacyKitchen]);

  // Al cambiar de cuenta no se muestra la cocina de la anterior.
  const kitchenOwner = profileId && isPatient ? profileId : null;
  const [loadedOwner, setLoadedOwner] = useState(null);
  if (loadedOwner !== kitchenOwner) {
    setLoadedOwner(kitchenOwner);
    setFridge([]);
    setShopping([]);
    setKitchenError(null);
    setKitchenStatus('idle');
  }

  useEffect(() => {
    // refreshKitchen es asíncrona: los datos llegan con la respuesta del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (kitchenOwner) refreshKitchen();
  }, [kitchenOwner, refreshKitchen]);

  /**
   * Aplica un cambio en pantalla al instante y lo manda al servidor.
   * Si el servidor lo rechaza, se muestra el error y se recarga lo guardado.
   */
  const syncKitchen = useCallback(async (request) => {
    try {
      await request();
      setKitchenError(null);
    } catch (err) {
      setKitchenError(err.message);
      try {
        applyKitchen(await api('/kitchen'));
      } catch {
        // Sin conexión: queda el mensaje de error; al volver a entrar se recarga.
      }
    }
  }, [applyKitchen]);

  // ---- Agua ----
  const waterToday = waterByDay[todayKey()] ?? 0;
  const changeWater = useCallback((delta) => {
    setWaterByDay((prev) => {
      const key = todayKey();
      const next = Math.max(0, Math.min(30, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  }, []);

  // ---- Heladera ----
  const addFridgeItem = useCallback((item) => {
    const body = { id: uuid(), name: cut(item.name, NAME_MAX), quantity: cut(item.quantity, QTY_MAX) };
    setFridge((prev) => [{ ...body, quantity: body.quantity || null, createdAt: new Date().toISOString() }, ...prev]);
    syncKitchen(async () => {
      const data = await api('/kitchen/fridge', { method: 'POST', body });
      // Ya había un alimento con ese nombre ("huevo" = "Huevos"): el servidor sumó la
      // cantidad al existente, así que se saca el nuevo y se actualiza el anterior.
      if (data?.merged) {
        setFridge((prev) => prev
          .filter((it) => it.id !== body.id)
          .map((it) => (it.id === data.item.id ? { ...it, ...data.item } : it)));
        showKitchenNotice(`Ya tenías ${data.item.name}: se sumó la cantidad${data.item.quantity ? ` (${data.item.quantity})` : ''}.`);
      }
    });
  }, [syncKitchen, showKitchenNotice]);
  const updateFridgeItem = useCallback((id, patch) => {
    const body = { name: cut(patch.name, NAME_MAX), quantity: cut(patch.quantity, QTY_MAX) };
    setFridge((prev) => prev.map((it) => (it.id === id ? { ...it, ...body, quantity: body.quantity || null } : it)));
    syncKitchen(() => api(`/kitchen/fridge/${id}`, { method: 'PATCH', body }));
  }, [syncKitchen]);
  const removeFridgeItem = useCallback((id) => {
    setFridge((prev) => prev.filter((it) => it.id !== id));
    syncKitchen(() => api(`/kitchen/fridge/${id}`, { method: 'DELETE' }));
  }, [syncKitchen]);

  // ---- Lista de compras ----
  const addShoppingItem = useCallback((item) => {
    const body = { id: uuid(), name: cut(item.name, NAME_MAX), quantity: cut(item.quantity, QTY_MAX) || '1' };
    setShopping((prev) => [{ ...body, done: false, createdAt: new Date().toISOString() }, ...prev]);
    syncKitchen(() => api('/kitchen/shopping', { method: 'POST', body }));
  }, [syncKitchen]);
  const updateShoppingItem = useCallback((id, patch) => {
    const body = { name: cut(patch.name, NAME_MAX), quantity: cut(patch.quantity, QTY_MAX) || '1' };
    setShopping((prev) => prev.map((it) => (it.id === id ? { ...it, ...body } : it)));
    syncKitchen(() => api(`/kitchen/shopping/${id}`, { method: 'PATCH', body }));
  }, [syncKitchen]);
  const toggleShoppingItem = useCallback((id) => {
    const current = shopping.find((it) => it.id === id);
    if (!current) return;
    const done = !current.done;
    setShopping((prev) => prev.map((it) => (it.id === id ? { ...it, done } : it)));
    syncKitchen(() => api(`/kitchen/shopping/${id}`, { method: 'PATCH', body: { done } }));
  }, [shopping, syncKitchen]);
  const removeShoppingItem = useCallback((id) => {
    setShopping((prev) => prev.filter((it) => it.id !== id));
    syncKitchen(() => api(`/kitchen/shopping/${id}`, { method: 'DELETE' }));
  }, [syncKitchen]);
  /** Reemplaza la lista con la que devolvió el servidor (ej. al agregar los faltantes de una receta). */
  const replaceShopping = useCallback((list) => {
    setShopping(Array.isArray(list) ? list : []);
  }, []);
  const clearBoughtItems = useCallback(() => {
    setShopping((prev) => prev.filter((it) => !it.done));
    syncKitchen(() => api('/kitchen/shopping-bought', { method: 'DELETE' }));
  }, [syncKitchen]);

  // Pro pago (Mercado Pago): vigente hasta planUntil (null = sin vencimiento, ej. dado por un administrador).
  const paidPro = plan === 'PREMIUM' && (!profile?.planUntil || new Date(profile.planUntil) > new Date());
  const premiumByCode = !paidPro && Boolean(profile?.premiumUntil) && new Date(profile.premiumUntil) > new Date();
  const isPremium = paidPro || premiumByCode;

  const value = useMemo(() => ({
    ready,
    profile,
    plan,
    // Premium efectivo: plan pago o código de nutricionista vigente
    isPremium,
    paidPro,
    premiumUntil: premiumByCode ? profile.premiumUntil : null,
    premiumByCode,
    myLink: profileId ? myLink : undefined,
    refreshLink,
    // Sin sesión no se muestran datos de otra cuenta
    streak: profileId ? streak : 0,
    meals: profileId ? meals : [],
    scansToday: (profileId && planInfo?.scansToday) || 0,
    freeDailyScanLimit: planInfo?.freeDailyScanLimit ?? FREE_DAILY_SCAN_LIMIT,
    dataError,
    refreshData,
    fetchMeals,
    waterToday,
    changeWater,
    kitchenStatus,
    kitchenError,
    kitchenNotice,
    refreshKitchen,
    fridge,
    addFridgeItem,
    updateFridgeItem,
    removeFridgeItem,
    shopping,
    addShoppingItem,
    updateShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearBoughtItems,
    replaceShopping,
    // Reemplaza heladera y lista con lo que devolvió el servidor
    setKitchenData: applyKitchen,
  }), [
    ready, profile, profileId, plan, isPremium, paidPro, premiumByCode, myLink, refreshLink, streak, meals, planInfo, dataError, refreshData, fetchMeals, waterToday, changeWater,
    kitchenStatus, kitchenError, kitchenNotice, refreshKitchen,
    fridge, addFridgeItem, updateFridgeItem, removeFridgeItem,
    shopping, addShoppingItem, updateShoppingItem, toggleShoppingItem, removeShoppingItem, clearBoughtItems, replaceShopping, applyKitchen,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
