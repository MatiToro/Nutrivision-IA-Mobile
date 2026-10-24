import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppProvider } from '../context/AppContext';
import { NutriProvider } from '../context/NutriContext';
import SessionErrorScreen from '../components/SessionErrorScreen';
import { initAds } from '../utils/ads';
import { colors } from '../theme';

// La pantalla de carga (logo) queda visible hasta saber si hay una sesión guardada.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // AdMob (anuncios del plan Gratuito): se inicializa una vez al abrir la app.
  useEffect(() => { initAds(); }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <NutriProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </NutriProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, initializing, profile, backendError, pendingRole } = useAuth();
  // Cuenta de nutricionista: pacientes, perfil profesional, suscripción.
  const isNutri = isAuthenticated && profile?.role === 'NUTRITIONIST';
  // Cuenta de administrador: panel de usuarios y solicitudes de nutricionistas.
  const isAdmin = isAuthenticated && profile?.role === 'ADMIN';
  // Cuenta recién creada (o que nunca completó sus datos): primero el formulario de objetivos.
  const needsOnboarding = isAuthenticated && profile != null && !isNutri && !isAdmin && !profile.onboardingCompleted;
  const isPatientApp = isAuthenticated && !isNutri && !isAdmin && !needsOnboarding;

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  if (initializing) return null;

  // Sesión iniciada pero el perfil todavía viene en camino (ej. justo después de registrarse).
  // (o se está aplicando el tipo de cuenta elegido al registrarse).
  if ((isAuthenticated && !profile && !backendError) || (pendingRole && profile?.role !== pendingRole)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Sesión iniciada pero el servidor no devolvió el perfil: no se sabe el rol de la
  // cuenta, así que no se muestra ninguna interfaz.
  if (isAuthenticated && !profile && backendError) return <SessionErrorScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Con sesión: la app. Sin sesión: login y registro. */}
      <Stack.Protected guard={isPatientApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="nutricionistas/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="nutricionistas/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="mi-nutricionista" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="receta/[key]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="progreso" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={isNutri}>
        <Stack.Screen name="(nutri)" />
        <Stack.Screen name="nutri-solicitud" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="nutri-paciente/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="nutri-metas/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="admin-usuario/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="admin-nutricionista/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/* Detalle de plato: el paciente ve los suyos; el nutricionista, los de sus pacientes */}
      <Stack.Protected guard={isPatientApp || isNutri}>
        <Stack.Screen name="comida/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="registro" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
