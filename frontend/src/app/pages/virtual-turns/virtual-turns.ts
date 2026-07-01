import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TurnService } from '../../services/turn.service';
import { AuthService } from '../../services/auth.service';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-virtual-turns',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './virtual-turns.html',
  styleUrl: './virtual-turns.css'
})
export class VirtualTurns implements OnInit, OnDestroy {
  turns: any[] = [];
  filteredTurns: any[] = [];
  filterSede = '';
  sedes: string[] = [];
  loading = false;

  activeVirtualTurn: any = null;
  chatMessages: { sender: string; text: string; time: string; isSystem: boolean }[] = [];
  newMessage = '';
  finishing = false;

  private destroy$ = new Subject<void>();
  private refreshInterval: any;

  constructor(
    private turn: TurnService,
    private auth: AuthService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
      return;
    }

    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        let allTurns: any[] = [];
        if (Array.isArray(msg)) {
          allTurns = msg;
        } else if (msg && msg.type === 'all_turns' && Array.isArray(msg.turns)) {
          allTurns = msg.turns;
        } else {
          return;
        }
        this.turns = allTurns.filter((t: any) => t.service_type === 'virtual');
        this.applyFilters();
        if (this.activeVirtualTurn) {
          const updated = allTurns.find((t: any) => t.number === this.activeVirtualTurn.number);
          if (updated) this.activeVirtualTurn = { ...this.activeVirtualTurn, ...updated };
        }
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }

    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 5000);
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

  loadData(): void {
    this.http.get('/api/sedes/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.sedes = (data.sedes || []).map((s: any) => s.name);
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.turns = (data.turns || []).filter((t: any) => t.service_type === 'virtual');
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.filteredTurns = this.turns.filter((t: any) => {
      if (this.filterSede && t.sede !== this.filterSede) return false;
      return t.status === 'waiting' || t.status === 'called';
    });
  }

  attendVirtual(turn: any): void {
    this.turn.callSpecific(turn.number).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.activeVirtualTurn = { ...turn, status: 'called' };
          this.chatMessages = [];
          this.addSystemMsg(`Turno ${turn.number} iniciado. Atendiendo al cliente ${turn.created_by || ''}.`);
          this.ws.send({ action: 'get_all' });
          this.cdr.detectChanges();
        } else {
          alert(data.message || 'Error al atender turno virtual');
        }
      },
      error: () => alert('Error al atender turno virtual')
    });
  }

  resumeVirtual(turn: any): void {
    this.activeVirtualTurn = turn;
    if (this.chatMessages.length === 0) {
      this.addSystemMsg(`Retomando atención del turno ${turn.number}.`);
    }
    this.cdr.detectChanges();
  }

  sendMessage(): void {
    const text = this.newMessage.trim();
    if (!text) return;
    const user = this.auth.getCurrentUser();
    this.chatMessages.push({
      sender: user?.full_name || user?.username || 'Empleado',
      text,
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      isSystem: false
    });
    this.newMessage = '';
    this.cdr.detectChanges();
  }

  private addSystemMsg(text: string): void {
    this.chatMessages.push({
      sender: 'Sistema',
      text,
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    });
  }

  finishVirtual(): void {
    if (!this.activeVirtualTurn || this.finishing) return;
    this.finishing = true;
    this.turn.finishCurrent().subscribe({
      next: () => {
        this.addSystemMsg('Turno finalizado exitosamente. ✓');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.chatMessages = [];
          this.finishing = false;
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: () => {
        this.finishing = false;
        alert('Error al finalizar turno');
      }
    });
  }

  rescheduleVirtual(): void {
    if (!this.activeVirtualTurn) return;
    this.turn.rescheduleCurrent().subscribe({
      next: () => {
        this.addSystemMsg('Turno reagendado. Volverá al final de la cola.');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.chatMessages = [];
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: () => alert('Error al reagendar turno')
    });
  }

  cancelVirtual(): void {
    if (!this.activeVirtualTurn) return;
    const number = this.activeVirtualTurn.number;
    this.http.delete(`/api/cancel-turn/${number}/`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.addSystemMsg('Turno cancelado por inasistencia.');
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        setTimeout(() => {
          this.activeVirtualTurn = null;
          this.chatMessages = [];
          this.loadData();
          this.cdr.detectChanges();
        }, 1500);
      },
      error: () => alert('Error al cancelar turno')
    });
  }

  closeChat(): void {
    this.activeVirtualTurn = null;
    this.chatMessages = [];
    this.cdr.detectChanges();
  }
}
