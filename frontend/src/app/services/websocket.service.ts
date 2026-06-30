import { Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket$: WebSocketSubject<any> | null = null;
  private messages = new BehaviorSubject<any | null>(null);
  private connected = new BehaviorSubject<boolean>(false);

  messages$ = this.messages.asObservable();
  connected$ = this.connected.asObservable();

  constructor(private zone: NgZone) {}

  connect(): void {
    if (this.socket$ && this.socket$.closed) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/turns`;

    this.socket$ = webSocket({
      url,
      closeObserver: {
        next: () => {
          this.zone.run(() => {
            this.connected.next(false);
          });
        }
      }
    });

    this.socket$.subscribe({
      next: (msg) => {
        this.zone.run(() => {
          this.messages.next(msg);
        });
      },
      error: (err) => {
        console.error('WebSocket error:', err);
        this.zone.run(() => {
          this.connected.next(false);
        });
      },
      complete: () => {
        this.zone.run(() => {
          this.connected.next(false);
        });
      }
    });

    this.connected.next(true);
  }

  send(message: any): void {
    if (this.socket$ && !this.socket$.closed) {
      this.socket$.next(message);
    }
  }

  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
      this.connected.next(false);
    }
  }

  isConnected(): boolean {
    return this.socket$ !== null && !this.socket$.closed;
  }
}
