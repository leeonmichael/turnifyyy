import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TurnService } from '../../services/turn.service';
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
  rescheduleTarget: string | null = null;
  rescheduleDate = '';
  readonly todayIso = new Date().toISOString().slice(0, 10);

  private destroy$ = new Subject<void>();
  private refreshInterval: any;

  constructor(
    private auth: AuthService,
    private turn: TurnService,
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

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadTurns(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.turns = (data.turns || []).filter((t: any) => t.status === 'waiting' || t.status === 'called');
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.turns = []; this.cdr.detectChanges(); }
    });
  }

  openReschedule(turnNumber: string): void {
    this.rescheduleTarget = turnNumber;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.rescheduleDate = d.toISOString().slice(0, 10);
    this.cdr.detectChanges();
  }

  confirmReschedule(turnNumber: string): void {
    if (!this.rescheduleDate) { alert('Selecciona una fecha'); return; }
    if (this.rescheduleDate < this.todayIso) { alert('No puedes reagendar para una fecha pasada'); return; }
    this.turn.rescheduleSpecificTurn(turnNumber, this.rescheduleDate).subscribe({
      next: (data: any) => {
        if (data.success === false) { alert(data.message || 'Error al reagendar'); return; }
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
