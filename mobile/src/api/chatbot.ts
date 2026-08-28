import { API_BASE_URL } from './config';
import { getToken } from './client';

export interface ChatHistoryItem {
  role: 'bot' | 'user';
  text: string;
}

export class ChatUnavailableError extends Error {}

// El backend responde NDJSON (una línea JSON por evento: 'chunk' | 'done' | 'error').
// fetch en React Native no soporta bien leer el body como stream incremental,
// así que se espera la respuesta completa y se arma el mensaje final de una vez.
export async function sendChatMessage(message: string, history: ChatHistoryItem[]): Promise<string> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/chatbot/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, history: history.slice(-10) }),
    });
  } catch {
    throw new ChatUnavailableError('No se pudo conectar con el asistente.');
  }

  if (res.status === 503) {
    throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  }
  if (!res.ok) {
    throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  }

  const raw = await res.text();
  let text = '';
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let evt: any;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type === 'chunk') text += evt.text;
    if (evt.type === 'error' && !text) throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  }

  if (!text) throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  return text;
}
