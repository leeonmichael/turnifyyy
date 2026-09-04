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

  cancelTurn(turn: any): void {
    const isRescheduled = !!turn.scheduled_for;
    if (isRescheduled) {
      const confirmed = confirm(
        'Este turno fue reagendado. Si lo cancelas ahora, se te generará una multa que se aplicará a tu próxima cita agendada. ¿Deseas continuar con la cancelación?'
      );
      if (!confirmed) return;
    }
    this.http.delete(`/api/cancel-turn-by-id/${turn.id}/`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        if (isRescheduled) alert('Turno cancelado. Se ha generado una multa para tu próxima cita agendada.');
        this.loadMyTurns();
      },
      error: () => alert('Error al cancelar el turno')
    });
  }

  // Un turno reagendado se guarda como 'waiting', pero al cliente hay que
  // mostrárselo como "Reagendado" para que no lo confunda con la cola de hoy.
  private isRescheduled(turn: any): boolean {
    return !!turn?.scheduled_for && turn?.status === 'waiting';
  }

  getStatusLabel(turn: any): string {
    if (this.isRescheduled(turn)) return 'Reagendado';
    const labels: { [key: string]: string } = {
      waiting: 'En espera',
      called: 'Llamando',
      finished: 'Atendido',
      cancelled: 'Cancelado',
      rescheduled: 'Reagendado'
    };
    return labels[turn?.status] || turn?.status || '';
  }

  getStatusClass(turn: any): string {
    if (this.isRescheduled(turn)) return 'status-rescheduled';
    const classes: { [key: string]: string } = {
      waiting: 'status-waiting',
      called: 'status-calling',
      finished: 'status-completed',
      cancelled: 'status-cancelled',
      rescheduled: 'status-rescheduled'
    };
    return classes[turn?.status] || '';
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
    return this.turns.filter(t => t.status === 'waiting' || t.status === 'called').length;
  }

  get finishedCount(): number {
    return this.turns.filter(t => t.status === 'finished').length;
  }

  get cancelledCount(): number {
    return this.turns.filter(t => t.status === 'cancelled').length;
  }
}
