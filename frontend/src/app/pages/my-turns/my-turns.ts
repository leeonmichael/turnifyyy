import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-turns',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-turns.html',
  styleUrl: './my-turns.css'
})
export class MyTurns implements OnInit, OnDestroy {
  turns: any[] = [];
  loading = false;
  private refreshInterval: any;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMyTurns();
    this.refreshInterval = setInterval(() => this.loadMyTurns(), 10000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadMyTurns(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.http.get('/api/my-turns/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.turns = data.turns || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.turns = [];
        this.cdr.detectChanges();
      }
    });
  }

  cancelTurn(turnId: string): void {
    this.http.delete(`/api/cancel-turn-by-id/${turnId}/`, { headers: this.getHeaders() }).subscribe({
      next: () => this.loadMyTurns(),
      error: () => alert('Error al cancelar el turno')
    });
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      waiting: 'En espera',
      called: 'Llamando',
      finished: 'Atendido',
      cancelled: 'Cancelado',
      rescheduled: 'Reagendado'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      waiting: 'status-waiting',
      called: 'status-calling',
      finished: 'status-completed',
      cancelled: 'status-cancelled',
      rescheduled: 'status-rescheduled'
    };
    return classes[status] || '';
  }

  getServiceLabel(type: string): string {
    const labels: { [key: string]: string } = {
      general: 'General',
      preferential: 'Preferencial',
      vip: 'VIP',
      emergency: 'Emergencia',
      virtual: 'Virtual'
    };
    return labels[type] || type;
  }

  get activeCount(): number {
    return this.turns.filter(t => t.status === 'waiting' || t.status === 'called' || t.status === 'rescheduled').length;
  }

  get finishedCount(): number {
    return this.turns.filter(t => t.status === 'finished').length;
  }

  get cancelledCount(): number {
    return this.turns.filter(t => t.status === 'cancelled').length;
  }
}
