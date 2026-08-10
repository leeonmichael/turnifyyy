import { api } from './client';

export interface RegisterPayload {
  username: string;
  password: string;
  confirm_password: string;
  full_name: string;
  document_type: string;
  cedula: string;
  email: string;
  phone: string;
  accept_terms: boolean;
}

export function registerClient(data: RegisterPayload) {
  return api.post('/register/', data);
}

export function login(username: string, password: string) {
  return api.post('/login/', { username, password });
}

export function logout() {
  return api.post('/logout/');
}

export function verifySession() {
  return api.get('/verify-session/');
}

export function updateProfile(data: Record<string, any>) {
  return api.put('/update-profile/', data);
}
