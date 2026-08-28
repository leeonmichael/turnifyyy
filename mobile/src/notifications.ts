import { Platform, Vibration } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Controla cómo se muestra una notificación mientras la app está abierta
// (en segundo plano / cerrada, el sistema operativo la maneja solo).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const VIBRATION_PATTERN = [0, 400, 200, 400];

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('turno-cercano', {
      name: 'Turno cercano',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: VIBRATION_PATTERN,
      sound: 'default',
      lightColor: '#2563eb',
    });
  }

  if (!Device.isDevice) {
    // Los simuladores/emuladores no pueden recibir push reales de Expo.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // El push token remoto de Expo necesita saber a qué proyecto EAS pertenece.
  // Sin `eas init` (ver README), projectId es undefined y esta llamada falla:
  // se captura y la app sigue funcionando, solo sin notificaciones push.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tokenResponse.data;
  } catch (e) {
    console.error('[push] getExpoPushTokenAsync failed:', e);
    return null;
  }
}

// Vibra de inmediato al recibir una notificación con la app en primer plano
// (el canal de Android ya vibra solo, pero iOS foreground no lo hace por defecto).
export function vibrateNow(): void {
  Vibration.vibrate(VIBRATION_PATTERN);
}

export function addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(callback);
}
