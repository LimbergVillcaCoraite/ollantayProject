import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import HomeScreen from '../screens/Home/HomeScreen';
import VentasScreen from '../screens/Ventas/VentasScreen';
import ProductosScreen from '../screens/Productos/ProductosScreen';
import EntregasScreen from '../screens/Entregas/EntregasScreen';
import MisDeudasScreen from '../screens/MisDeudas/MisDeudasScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigatorTabs(){
  const { hasPermission, user } = useAuth();
  const role = user?.role || 'viewer';
  return (
    <Tab.Navigator screenOptions={{ headerShown:false, tabBarActiveTintColor:'#6366f1', tabBarInactiveTintColor:'#9ca3af' }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel:'Inicio' }} />
      {hasPermission('ventas','view') && (
        <Tab.Screen name="Ventas" component={VentasScreen} options={{ tabBarLabel:'Ventas' }} />
      )}
      {hasPermission('productos','view') && (
        <Tab.Screen name="Productos" component={ProductosScreen} options={{ tabBarLabel:'Productos' }} />
      )}
      {role === 'chofer' && (
        <Tab.Screen name="Entregas" component={EntregasScreen} options={{ tabBarLabel:'Entregas' }} />
      )}
      {role === 'cliente' && (
        <Tab.Screen name="MisDeudas" component={MisDeudasScreen} options={{ tabBarLabel:'Mis Deudas' }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel:'Perfil' }} />
    </Tab.Navigator>
  );
}
