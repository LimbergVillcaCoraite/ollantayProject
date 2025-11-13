import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createStackNavigator();

function RootInner() {
  const { loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <LoadingScreen colors={colors} />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function LoadingScreen({ colors }) {
  return (
    <>
      {/* Simple loading placeholder to avoid blank white screen */}
      <div style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors?.background || '#fff' }}>
        <p style={{ color: colors?.text || '#333', fontSize: 16 }}>Cargando...</p>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootInner />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
