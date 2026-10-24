import { ActivityIndicator, View } from 'react-native';
import { Tabs } from 'expo-router';
import { CreditCard, UserRound, Users } from 'lucide-react-native';
import TabBar from '../../components/TabBar';
import NutriStatus from '../../components/NutriStatus';
import { useNutri } from '../../context/NutriContext';
import { colors } from '../../theme';

/**
 * App del nutricionista. Mientras la cuenta no está aprobada se muestra el estado
 * de la solicitud; una vez aprobada: Pacientes · Mi perfil · Suscripción.
 */
export default function NutriLayout() {
  const { data, loading } = useNutri();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data?.profile || data.profile.status !== 'APPROVED') return <NutriStatus />;

  return (
    <Tabs initialRouteName="pacientes" screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="pacientes" options={{ title: 'Pacientes', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="mi-perfil" options={{ title: 'Mi perfil', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
      <Tabs.Screen name="suscripcion" options={{ title: 'Suscripción', tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size} /> }} />
    </Tabs>
  );
}
