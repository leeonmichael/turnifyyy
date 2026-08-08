import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PendingChatMessage {
  text: string;
  time: string;
}

const STORAGE_KEY = 'turnify_pending_assistant_msgs';
const NOTIFIED_KEY = 'turnify_proactive_notified_turn';

@Injectable({
  providedIn: 'root'
})
export class ChatNotificationService {
  private pending = new BehaviorSubject<PendingChatMessage[]>(this.readFromStorage());
  pending$ = this.pending.asObservable();

  private readFromStorage(): PendingChatMessage[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private writeToStorage(items: PendingChatMessage[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  addMessage(text: string): void {
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const items = [...this.pending.value, { text, time }];
    this.pending.next(items);
    this.writeToStorage(items);
  }

  takePending(): PendingChatMessage[] {
    const items = this.pending.value;
    this.pending.next([]);
    this.writeToStorage([]);
    return items;
  }

  // Evita mandar el mismo aviso proactivo más de una vez para el mismo turno.
  hasNotifiedForTurn(turnNumber: string): boolean {
    return localStorage.getItem(NOTIFIED_KEY) === turnNumber;
  }

  markNotifiedForTurn(turnNumber: string): void {
    localStorage.setItem(NOTIFIED_KEY, turnNumber);
  }
}
