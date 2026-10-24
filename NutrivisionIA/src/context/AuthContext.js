import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../api/firebase';
import { api } from '../api/client';
import { getGoogleIdToken, googleErrorMessage, googleSignOut } from '../utils/googleSignIn';

/**
 * Sesión del usuario.
 * Igual que en la Web: el login/registro lo hace Firebase Authentication
 * (el backend nunca ve contraseñas) y después se sincroniza la sesión con
 * POST /api/auth/session, que devuelve el perfil guardado en PostgreSQL.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Si Firebase no está configurado no hay sesión que restaurar.
  const [initializing, setInitializing] = useState(Boolean(auth));
  const [backendError, setBackendError] = useState(null);
  // Tipo de cuenta elegido al registrarse ("Soy nutricionista"): mientras se aplica
  // en el backend, la app no muestra pantallas de otro rol.
  const [pendingRole, setPendingRole] = useState(null);

  // Si hay dos pedidos de perfil en paralelo (ej. al registrarse), solo vale el último.
  const requestSeq = useRef(0);
  const fetchProfile = useCallback(async () => {
    const seq = ++requestSeq.current;
    const data = await api('/auth/session', { method: 'POST' });
    if (seq === requestSeq.current) {
      setProfile(data.user);
      setBackendError(null);
    }
    return data.user;
  }, []);

  /** "Reintentar" desde el aviso de conexión: si vuelve a fallar, queda el mensaje nuevo. */
  const retrySession = useCallback(async () => {
    try {
      await fetchProfile();
    } catch (err) {
      setBackendError(err.message);
    }
  }, [fetchProfile]);

  /** Actualiza el perfil local con la respuesta del backend (invalida pedidos viejos en curso). */
  const applyProfile = useCallback((user) => {
    requestSeq.current += 1;
    setProfile(user);
  }, []);

  // Sesión guardada en el teléfono: al abrir la app se restaura sola.
  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await fetchProfile();
        } catch (err) {
          // Sesión válida en Firebase pero el backend no respondió: no cerramos
          // la sesión, mostramos el aviso y se puede reintentar.
          setBackendError(err.message);
        }
      } else {
        setProfile(null);
        setBackendError(null);
      }
      setInitializing(false);
    });
    return unsubscribe;
  }, [fetchProfile]);

  const login = useCallback(async ({ email, password }) => {
    ensureConfigured();
    await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      await fetchProfile();
    } catch (err) {
      // Sin backend no hay perfil: cerramos la sesión para no dejar la app a medias.
      await signOut(auth);
      throw err;
    }
  }, [fetchProfile]);

  const register = useCallback(async ({ email, password, displayName, role = 'USER' }) => {
    ensureConfigured();
    if (role !== 'USER') setPendingRole(role);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName) {
        await updateProfile(credential.user, { displayName });
        // Refresca el token para que el backend reciba el nombre recién cargado.
        await credential.user.getIdToken(true);
      }
      let user = await fetchProfile();
      // Red de seguridad (igual que en la Web): si el usuario se creó sin nombre, se corrige.
      if (displayName && !user?.displayName) {
        const data = await api('/users/me', { method: 'PATCH', body: { displayName } });
        user = data.user;
        applyProfile(user);
      }
      if (role !== 'USER' && user?.role !== role) {
        const data = await api('/users/me/role', { method: 'POST', body: { role } });
        applyProfile(data.user);
      }
    } catch (err) {
      // La cuenta se creó en Firebase pero el servidor falló: queda el aviso con
      // "Reintentar" (al reintentar, el servidor crea el perfil) en vez de una carga infinita.
      if (auth?.currentUser) setBackendError(err.message);
      throw err;
    } finally {
      setPendingRole(null);
    }
  }, [fetchProfile, applyProfile]);

  /**
   * Inicio de sesión / registro con Google (igual que en la Web).
   * `role`: desde el Registro, el tipo de cuenta elegido antes de tocar "Continuar con Google".
   * Devuelve false si el usuario cerró el selector de cuentas sin elegir ninguna.
   */
  const loginWithGoogle = useCallback(async ({ role } = {}) => {
    ensureConfigured();
    const idToken = await getGoogleIdToken();
    if (!idToken) return false;
    if (role && role !== 'USER') setPendingRole(role);
    try {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      let user;
      try {
        user = await fetchProfile();
      } catch (err) {
        // Sin backend no hay perfil: cerramos la sesión para no dejar la app a medias.
        await signOut(auth);
        await googleSignOut();
        throw err;
      }
      // Solo se aplica si la cuenta es nueva: una cuenta de Google que ya se usa
      // como paciente no se convierte (el backend lo rechaza).
      if (role && role !== 'USER' && user?.role === 'USER' && !user.onboardingCompleted) {
        const data = await api('/users/me/role', { method: 'POST', body: { role } });
        applyProfile(data.user);
      }
      return true;
    } finally {
      setPendingRole(null);
    }
  }, [fetchProfile, applyProfile]);

  /** Cambia el tipo de cuenta (solo en cuentas nuevas, sin datos). */
  const changeRole = useCallback(async (role) => {
    const data = await api('/users/me/role', { method: 'POST', body: { role } });
    applyProfile(data.user);
    return data.user;
  }, [applyProfile]);

  const resetPassword = useCallback(async (email) => {
    ensureConfigured();
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    if (auth) await signOut(auth);
    await googleSignOut();
    setProfile(null);
    setBackendError(null);
  }, []);

  const value = useMemo(() => ({
    firebaseUser,
    profile,
    setProfile: applyProfile,
    initializing,
    backendError,
    isAuthenticated: Boolean(firebaseUser),
    refreshProfile: fetchProfile,
    retrySession,
    login,
    loginWithGoogle,
    register,
    changeRole,
    pendingRole,
    resetPassword,
    logout,
  }), [firebaseUser, profile, applyProfile, initializing, backendError, fetchProfile, login, loginWithGoogle, register, changeRole, pendingRole, resetPassword, logout, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

function ensureConfigured() {
  if (!auth) {
    const err = new Error('Falta la configuración de Firebase (archivo .env.local).');
    err.code = 'app/not-configured';
    throw err;
  }
}

/** Traduce los códigos de error de Firebase a mensajes claros en español. */
export function authErrorMessage(err) {
  const googleMsg = googleErrorMessage(err);
  if (googleMsg) return googleMsg;
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('invalid-email')) return 'El correo no es válido.';
  if (code.includes('email-already-in-use')) return 'Ese correo ya tiene una cuenta. Iniciá sesión.';
  if (code.includes('weak-password')) return 'La contraseña es muy débil (mínimo 6 caracteres).';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Esperá un momento y probá de nuevo.';
  if (code.includes('network-request-failed')) return 'Sin conexión a internet. Revisá tu red.';
  if (code.includes('account-exists-with-different-credential')) {
    return 'Ese correo ya tiene una cuenta con otro método de ingreso. Iniciá sesión con tu correo y contraseña.';
  }
  return err?.message || 'No pudimos completar la acción. Probá de nuevo.';
}
