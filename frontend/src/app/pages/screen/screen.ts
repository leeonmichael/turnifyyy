import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './screen.html',
  styleUrl: './screen.css'
})
export class Screen implements OnInit, OnDestroy {
  currentTurn: any   = null;
  nextTurns: any[]   = [];
  waitingCount       = 0;
  timer              = '--:--:--';
  dateLabel          = '';
  connected          = false;

  private destroy$     = new Subject<void>();
  private clockInterval: any;
  private pollInterval: any;

  constructor(
    private ws:   WebsocketService,
    private http: HttpClient,
    private auth: AuthService,
    private cdr:  ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // ── Reloj en tiempo real ─────────────────────────────────────────
    this.updateClock();
    this.clockInterval = setInterval(() => {
      this.updateClock();
      this.cdr.detectChanges();
    }, 1000);

    // ── WebSocket: maneja AMBOS formatos de mensaje ──────────────────
    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg: any) => {
        let allTurns: any[] = [];
        if (Array.isArray(msg)) {
          allTurns = msg;
        } else if (msg?.type === 'all_turns' && Array.isArray(msg.turns)) {
          allTurns = msg.turns;
        } else {
          return;
        }
        this.processData(allTurns);
        this.connected = true;
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) this.ws.connect();
    this.ws.send({ action: 'get_all' });

    // ── Carga inicial HTTP ───────────────────────────────────────────
    this.fetchFromHttp();

    // ── Polling periódico cada 3s (WS + HTTP fallback) ──────────────
    this.pollInterval = setInterval(() => {
      if (this.ws.isConnected()) {
        this.ws.send({ action: 'get_all' });
      } else {
        this.connected = false;
        this.fetchFromHttp();
        this.cdr.detectChanges();
      }
    }, 3000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.pollInterval)  clearInterval(this.pollInterval);
  }

  private processData(turns: any[]): void {
    this.currentTurn  = turns.find((t: any) => t.status === 'called') || null;
    const waiting     = turns.filter((t: any) => t.status === 'waiting' && !t.scheduled_for_later);
    this.nextTurns    = waiting.slice(0, 5);
    this.waitingCount = waiting.length;
  }

  private fetchFromHttp(): void {
    const token   = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    this.http.get<any>('/api/all/', { headers }).subscribe({
      next: (data: any) => {
        if (Array.isArray(data?.turns)) {
          this.processData(data.turns);
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  private updateClock(): void {
    const now       = new Date();
    this.timer      = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.dateLabel  = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
