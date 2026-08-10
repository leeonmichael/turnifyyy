import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { addNotificationReceivedListener, vibrateNow } from './src/notifications';

export default function App() {
  useEffect(() => {
    // Con la app abierta, el SO no siempre vibra por su cuenta (sobre todo en iOS) —
    // forzamos la vibración apenas llega cualquier notificación de turno.
    const sub = addNotificationReceivedListener(() => vibrateNow());
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
