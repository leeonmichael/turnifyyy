// Cambia USE_REMOTE a true cuando el backend ya esté desplegado en Render
// (funciona en cualquier red, no solo en tu wifi). Con false usa tu PC en LAN.
const USE_REMOTE = false;

// IP local (LAN) de la PC donde corre el backend Django.
// - Celular físico + Expo Go: usa la IP LAN de tu PC (ipconfig -> IPv4)
// - Emulador Android (Android Studio): usa 10.0.2.2
// - Simulador iOS (Mac): puedes usar localhost
const LAN_HOST = '192.168.1.8';
const LAN_PORT = 8000;

// URL pública de Render una vez desplegado, ej: https://turnify-pro-backend.onrender.com
const REMOTE_URL = 'https://REEMPLAZA-CON-TU-URL-DE-RENDER.onrender.com';

const LAN_HTTP_URL = `http://${LAN_HOST}:${LAN_PORT}`;

export const API_BASE_URL = `${USE_REMOTE ? REMOTE_URL : LAN_HTTP_URL}/api`;

export const WS_BASE_URL = USE_REMOTE
  ? `${REMOTE_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/turns`
  : `ws://${LAN_HOST}:${LAN_PORT}/ws/turns`;
