import { API_BASE_URL } from './config';
import { getToken } from './client';

export interface ChatHistoryItem {
  role: 'bot' | 'user';
  text: string;
}

export interface ChatReply {
  text: string;
  options: string[];
}

export class ChatUnavailableError extends Error {}

function parseNdjson(raw: string): { text: string; options: string[]; transcript?: string } {
  let text = '';
  let options: string[] = [];
  let transcript: string | undefined;
  let sawError = false;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let evt: any;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt.type === 'transcript') transcript = evt.text;
    if (evt.type === 'chunk') text += evt.text;
    if (evt.type === 'options') options = evt.options || [];
    if (evt.type === 'error') sawError = true;
  }

  if (!text && sawError) throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  return { text, options, transcript };
}

// El backend responde NDJSON (una línea JSON por evento: 'chunk' | 'options' | 'done' | 'error').
// fetch en React Native no soporta bien leer el body como stream incremental,
// así que se espera la respuesta completa y se arma el mensaje final de una vez.
export async function sendChatMessage(message: string, history: ChatHistoryItem[]): Promise<ChatReply> {
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

  if (!res.ok) throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');

  const { text, options } = parseNdjson(await res.text());
  if (!text) throw new ChatUnavailableError('El asistente de IA no está disponible en este momento.');
  return { text, options };
}

// Envía una nota de voz grabada (expo-av) al backend, que la transcribe con
// Gemini y responde con la misma lógica del chat escrito. Devuelve también
// la transcripción para mostrarla como si fuera el mensaje del usuario.
export async function sendVoiceMessage(
  audioUri: string,
  history: ChatHistoryItem[]
): Promise<ChatReply & { transcript: string }> {
  const token = await getToken();
  const form = new FormData();
  form.append('audio', { uri: audioUri, name: 'voice.m4a', type: 'audio/m4a' } as any);
  form.append('history', JSON.stringify(history.slice(-10)));

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/chatbot/voice/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ChatUnavailableError('No se pudo conectar con el asistente.');
  }

  if (res.status === 422) {
    throw new ChatUnavailableError('No logré entender el audio. Intenta de nuevo hablando un poco más claro.');
  }
  if (!res.ok) throw new ChatUnavailableError('El asistente de voz no está disponible en este momento.');

  const { text, options, transcript } = parseNdjson(await res.text());
  if (!text) throw new ChatUnavailableError('El asistente de voz no está disponible en este momento.');
  return { text, options, transcript: transcript || '' };
}
