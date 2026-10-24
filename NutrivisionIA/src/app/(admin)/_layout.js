import { Tabs } from 'expo-router';
import { LayoutDashboard, Stethoscope, Users } from 'lucide-react-native';
import TabBar from '../../components/TabBar';

/** Panel de Administrador: Resumen · Usuarios · Nutricionistas. */
export default function AdminLayout() {
  return (
    <Tabs initialRouteName="resumen" screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="resumen" options={{ title: 'Resumen', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="solicitudes" options={{ title: 'Nutricionistas', tabBarIcon: ({ color, size }) => <Stethoscope color={color} size={size} /> }} />
    </Tabs>
  );
}
