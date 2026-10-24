import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

/**
 * Datos de la cuenta de nutricionista (GET /api/nutritionist/me): estado de la
 * solicitud, perfil profesional, suscripción, códigos Premium y estadísticas.
 * Solo se cargan si la cuenta tiene rol NUTRITIONIST.
 */
const NutriContext = createContext(null);

export function NutriProvider({ children }) {
  const { profile, setProfile } = useAuth();
  const isNutri = profile?.role === 'NUTRITIONIST';
  const userId = profile?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // Si cambia la cuenta (cerrar sesión y entrar con otra), se descartan los datos anteriores.
  const [dataOwner, setDataOwner] = useState(userId);
  if (dataOwner !== userId) {
    setDataOwner(userId);
    setData(null);
    setError(null);
  }

  const refresh = useCallback(async () => {
    try {
      const res = await api('/nutritionist/me');
      setData(res);
      setError(null);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    // refresh es asíncrona: el estado se actualiza al llegar la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (userId && isNutri) refresh();
  }, [userId, isNutri, refresh]);

  /** Aplica una respuesta de /nutritionist/me (y mantiene nombre/foto al día en la sesión). */
  const apply = useCallback((res) => {
    setData(res);
    setError(null);
    if (res?.user && profile && (res.user.displayName !== profile.displayName)) {
      setProfile({ ...profile, displayName: res.user.displayName });
    }
  }, [profile, setProfile]);

  const value = useMemo(() => ({
    data: isNutri ? data : null,
    loading: isNutri && data === null && !error,
    error,
    refresh,
    apply,
  }), [isNutri, data, error, refresh, apply]);

  return <NutriContext.Provider value={value}>{children}</NutriContext.Provider>;
}

export function useNutri() {
  const ctx = useContext(NutriContext);
  if (!ctx) throw new Error('useNutri debe usarse dentro de <NutriProvider>');
  return ctx;
}
