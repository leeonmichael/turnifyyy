import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { WebsocketService } from '../../services/websocket.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-reschedule-turns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reschedule-turns.html',
  styleUrl: './reschedule-turns.css'
})
export class RescheduleTurns implements OnInit, OnDestroy {
  turns: any[] = [];
  loading = false;
  loadedOnce = false;
  rescheduleTarget: string | null = null;
  rescheduleDate = '';
  minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.toDateString(d);
  })();

  private destroy$ = new Subject<void>();
  private refreshInterval: any;

  constructor(
    private auth: AuthService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) { this.router.navigate(['/login']); return; }

    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        let all: any[] = [];
        if (Array.isArray(msg)) all = msg;
        else if (msg?.type === 'all_turns') all = msg.turns || [];
        else return;
        // Mientras se está eligiendo una fecha no se toca la tabla: si se
        // reemplaza la lista, la fila en edición se recrea y el formulario
        // se cierra solo.
        if (this.rescheduleTarget) return;
        this.turns = all.filter((t: any) => t.status === 'waiting' || t.status === 'called');
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) this.ws.connect();
    this.loadTurns();
    this.refreshInterval = setInterval(() => this.loadTurns(), 5000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  trackByTurnId(index: number, turn: any): string {
    return turn.id;
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return token ? headers.set('Authorization', `Bearer ${token}`) : headers;
  }

  loadTurns(): void {
    // El refresco automático no debe interrumpir un reagendamiento en curso.
    if (this.rescheduleTarget) return;

    // "Cargando..." solo en la primera carga; en los refrescos siguientes la
    // tabla se actualiza en su sitio, sin desaparecer y volver a aparecer.
    if (!this.loadedOnce) {
      this.loading = true;
      this.cdr.detectChanges();
    }
    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.loadedOnce = true;
        if (this.rescheduleTarget) return;
        this.turns = (data.turns || []).filter((t: any) => t.status === 'waiting' || t.status === 'called');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.loadedOnce = true;
        // Ante un fallo puntual se conserva la última lista buena en vez de
        // vaciar la tabla.
        console.error('Error loading turns:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private toDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  openReschedule(turnId: string): void {
    this.rescheduleTarget = turnId;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.rescheduleDate = this.toDateString(d);
    this.cdr.detectChanges();
  }

  confirmReschedule(turnId: string): void {
    if (!this.rescheduleDate) { alert('Selecciona una fecha'); return; }
    if (this.rescheduleDate < this.minDate) { alert('Solo se puede reagendar a partir de mañana'); return; }
    this.http.put(
      `/api/reschedule-turn/${turnId}/`,
      { scheduled_date: this.rescheduleDate },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (data: any) => {
        this.rescheduleTarget = null;
        this.rescheduleDate = '';
        this.loadTurns();
        this.cdr.detectChanges();
      },
      error: (err: any) => alert(err?.error?.message || 'Error al reagendar')
    });
  }

  cancelReschedule(): void {
    this.rescheduleTarget = null;
    this.rescheduleDate = '';
    this.cdr.detectChanges();
  }

  cancelTurn(turnNumber: string): void {
    this.http.delete(`/api/cancel-turn/${turnNumber}/`, { headers: this.getHeaders() }).subscribe({
      next: () => this.loadTurns(),
      error: () => alert('Error al cancelar el turno')
    });
  }
}
