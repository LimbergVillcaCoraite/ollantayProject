import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DrawerNavigator from './DrawerNavigator';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import VentasScreen from '../screens/Ventas/VentasScreen';
import VentaDetailScreen from '../screens/Ventas/VentaDetailScreen';
import ProductosScreen from '../screens/Productos/ProductosScreen';
import EntregasScreen from '../screens/Entregas/EntregasScreen';
import ClientesScreen from '../screens/Clientes/ClientesScreen';
import MisDeudasScreen from '../screens/MisDeudas/MisDeudasScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { hasPermission, user } = useAuth();
  const role = user?.role || 'viewer';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Inicio' }}
      />
      
      {hasPermission('ventas', 'view') && (
        <Tab.Screen 
          name="Ventas" 
          component={VentasScreen}
          options={{ tabBarLabel: 'Ventas' }}
        />
      )}
      
      {hasPermission('productos', 'view') && (
        <Tab.Screen 
          name="Productos" 
          component={ProductosScreen}
          options={{ tabBarLabel: 'Productos' }}
        />
      )}
      
      {role === 'chofer' && (
        <Tab.Screen 
          name="Entregas" 
          component={EntregasScreen}
          options={{ tabBarLabel: 'Entregas' }}
        />
      )}
      
      {role === 'cliente' && (
        <Tab.Screen 
          name="MisDeudas" 
          component={MisDeudasScreen}
          options={{ tabBarLabel: 'Mis Deudas' }}
        />
      )}
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // TODO: Add loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={DrawerNavigator} />
          <Stack.Screen name="VentaDetail" component={VentaDetailScreen} />
          <Stack.Screen name="Clientes" component={ClientesScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
