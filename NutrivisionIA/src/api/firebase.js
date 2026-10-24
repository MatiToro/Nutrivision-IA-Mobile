import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, isFirebaseConfigured } from './config';

// Mismo proyecto de Firebase que la Web → los mismos usuarios sirven en ambas.
const app = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

function createAuth() {
  if (!app) return null;
  try {
    // La sesión queda guardada en el teléfono: no hay que loguearse cada vez que se abre la app.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
