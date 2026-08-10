// Cambia USE_REMOTE a false para volver a usar tu PC en LAN (desarrollo local).
// En true, la app funciona en cualquier red porque habla con el backend en Render.
const USE_REMOTE = true;

// IP local (LAN) de la PC donde corre el backend Django.
// - Celular físico + Expo Go: usa la IP LAN de tu PC (ipconfig -> IPv4)
// - Emulador Android (Android Studio): usa 10.0.2.2
// - Simulador iOS (Mac): puedes usar localhost
const LAN_HOST = '192.168.1.8';
const LAN_PORT = 8000;

// URL pública del backend en Render.
const REMOTE_URL = 'https://turnify-pro-backend.onrender.com';

const LAN_HTTP_URL = `http://${LAN_HOST}:${LAN_PORT}`;

export const API_BASE_URL = `${USE_REMOTE ? REMOTE_URL : LAN_HTTP_URL}/api`;

export const WS_BASE_URL = USE_REMOTE
  ? `${REMOTE_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/turns`
  : `ws://${LAN_HOST}:${LAN_PORT}/ws/turns`;
