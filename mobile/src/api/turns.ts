import { api } from './client';

export interface Sede {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface ActiveTurn {
  id: string;
  number: string;
  status: 'waiting' | 'called' | 'finished' | 'cancelled';
  service_type: string;
  sede: string;
  sede_id: string;
  created_at: string;
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

export function getMyTurns(): Promise<{ turns: any[] }> {
  return api.get('/my-turns/');
}

export function getPosition(turn_number: string) {
  return api.get(`/position/?turn_number=${encodeURIComponent(turn_number)}`);
}

export function cancelTurn(turn_number: string) {
  return api.delete(`/cancel-turn/${encodeURIComponent(turn_number)}/`);
}
