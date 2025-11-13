import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function HomeScreen({ navigation }) {
  const { user, hasPermission } = useAuth();
  const { colors, isDark } = useTheme();

  const shortcuts = [
    {
      title: 'Ventas',
      icon: '💰',
      screen: 'Ventas',
      permission: { resource: 'ventas', action: 'view' },
    },
    {
      title: 'Productos',
      icon: '📦',
      screen: 'Productos',
      permission: { resource: 'productos', action: 'view' },
    },
    {
      title: 'Clientes',
      icon: '👥',
      screen: 'Clientes',
      permission: { resource: 'personas', action: 'view' },
    },
    {
      title: 'Entregas',
      icon: '🚚',
      screen: 'Entregas',
      role: 'chofer',
    },
    {
      title: 'Mis Deudas',
      icon: '💳',
      screen: 'MisDeudas',
      role: 'cliente',
    },
  ];

  const visibleShortcuts = shortcuts.filter(s => {
    if (s.role) return user?.role === s.role;
    if (s.permission) return hasPermission(s.permission.resource, s.permission.action);
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hola, {user?.nombre || user?.usuario}
          </Text>
          <Text style={[styles.role, { color: colors.border }]}>
            {user?.role || 'Usuario'}
          </Text>
        </View>

        <View style={styles.shortcuts}>
          {visibleShortcuts.map((shortcut, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.shortcut, { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate(shortcut.screen)}
            >
              <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
              <Text style={[styles.shortcutTitle, { color: colors.text }]}>
                {shortcut.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shortcut: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  shortcutTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
