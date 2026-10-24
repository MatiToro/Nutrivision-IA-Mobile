import { Tabs } from 'expo-router';
import { CalendarDays, House, Refrigerator, User } from 'lucide-react-native';
import TabBar from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="escanear" options={{ title: 'Escanear' }} />
      <Tabs.Screen name="cocina" options={{ title: 'Cocina', tabBarIcon: ({ color, size }) => <Refrigerator color={color} size={size} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
