import { useCallback, useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import { api } from '../api/client';


export function formatARS(n) {
  const s = String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${s}`;
}

export const longDay = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
export const shortDay = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

/**
 * Pago con Mercado Pago (suscripción con débito automático):
 * 1. El backend crea la suscripción y devuelve el link de pago (init_point).
 * 2. Se abre en el navegador / app de Mercado Pago y el usuario carga la tarjeta.
 * 3. Al volver a la app (por el link de retorno o a mano), se sincroniza el
 *    estado con el backend sin esperar al webhook.
 *
 * `onReturn(subscriptionId)` se llama cuando la app recupera el foco después
 * de abrir el checkout.
 */
export function useMercadoPagoCheckout(onReturn) {
  const pending = useRef(null);
  const handler = useRef(onReturn);
  useEffect(() => { handler.current = onReturn; }, [onReturn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pending.current) {
        const id = pending.current;
        pending.current = null;
        handler.current?.(id);
      }
    });
    return () => sub.remove();
  }, []);

  /** Crea la suscripción y abre Mercado Pago. Devuelve { subscriptionId, withTrial }. */
  const start = useCallback(async (kind) => {
    const data = await api('/payments/subscriptions', { method: 'POST', body: { kind }, timeout: 25000 });
    pending.current = data.subscriptionId;
    await Linking.openURL(data.initPoint);
    return data;
  }, []);

  return { start };
}

/** Pide al backend que consulte Mercado Pago y actualice la suscripción. */
export function syncSubscription(id) {
  return api(`/payments/subscriptions/${id}/sync`, { method: 'POST', timeout: 25000 });
}

export function cancelSubscription(id) {
  return api(`/payments/subscriptions/${id}/cancel`, { method: 'POST', timeout: 25000 });
}
