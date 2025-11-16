import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { TouchableOpacity, Text } from 'react-native';
import AppNavigatorTabs from './TabsOnly';
import CompanySelectorScreen from '../screens/Admin/CompanySelectorScreen';

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <Drawer.Screen name="Inicio" component={AppNavigatorTabs} />
      <Drawer.Screen name="Cambiar Empresa" component={CompanySelectorScreen} />
    </Drawer.Navigator>
  );
}
