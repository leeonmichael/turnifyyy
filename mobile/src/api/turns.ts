import { api } from './client';
import { API_BASE_URL } from './config';
import { getToken, handleUnauthorized } from './client';

export interface Sede {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface RequiredDocument {
  key: string;
  label: string;
  required: boolean;
}

export interface UploadedDocument {
  key: string;
  label: string;
  url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string;
}

export interface ChatMessage {
  sender_name: string;
  sender_role: 'client' | 'employee';
  text: string;
  at: string;
}

export interface ActiveTurn {
  id: string;
  number: string;
  status: 'waiting' | 'called' | 'finished' | 'cancelled' | 'rescheduled';
  service_type: string;
  sede: string;
  sede_id: string;
  created_at: string;
  meet_link?: string;
  required_documents?: RequiredDocument[];
  uploaded_documents?: UploadedDocument[];
  chat_messages?: ChatMessage[];
}

export interface MyTurn {
  id: string;
  number: string;
  status: string;
  service_type: string;
  sede: string;
  sede_id: string;
  created_at: string;
  finished_at: string | null;
  scheduled_for: string | null;
  meet_link?: string;
}

export function getSedes(): Promise<{ sedes: Sede[] }> {
  return api.get('/sedes/');
}

export function createTurn(service_type: string, sede_id: string) {
  return api.post('/create/', { service_type, sede_id });
}

export function getMyActiveTurn(): Promise<{ turn: ActiveTurn | null }> {
  return api.get('/my-active-turn/');
}

export function getMyTurns(): Promise<{ turns: MyTurn[] }> {
  return api.get('/my-turns/');
}

export function getPosition(turn_number: string) {
  return api.get(`/position/?turn_number=${encodeURIComponent(turn_number)}`);
}

export function cancelTurn(turn_number: string) {
  return api.delete(`/cancel-turn/${encodeURIComponent(turn_number)}/`);
}

export function getDocumentRequirements(): Promise<{ documents: RequiredDocument[] }> {
  return api.get('/virtual/document-requirements/');
}

// multipart/form-data: no se puede usar el cliente JSON genérico.
export async function uploadVirtualDocument(
  turnNumber: string,
  documentKey: string,
  file: { uri: string; name: string; mimeType?: string }
): Promise<{ success: boolean; message?: string }> {
  const token = await getToken();
  const form = new FormData();
  form.append('turn_number', turnNumber);
  form.append('document_key', documentKey);
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as any);

  const res = await fetch(`${API_BASE_URL}/virtual/upload-document/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (token && res.status === 401) await handleUnauthorized();
    throw new Error(data?.message || 'Error al subir el documento');
  }
  return data;
}

export function sendVirtualChatMessage(turn_number: string, text: string) {
  return api.post('/virtual/send-message/', { turn_number, text });
}
