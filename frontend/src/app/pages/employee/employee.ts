import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TurnService } from '../../services/turn.service';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './employee.html',
  styleUrl: './employee.css'
})
export class Employee implements OnInit, OnDestroy {
  turns: any[] = [];
  waitingTurns: any[] = [];
  currentTurn: any = null;
  stats = { waiting: 0, totalToday: 0, processed: 0 };
  showActionModal = false;
  sedes: any[] = [];

  private destroy$ = new Subject<void>();
  private refreshInterval: any;
  currentUser: any = null;

  constructor(
    private auth: AuthService,
    private turn: TurnService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    const role = this.auth.getCurrentRole();
    if (!role || role !== 'employee') {
      localStorage.clear();
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
        this.turns = allTurns;
        this.refreshTurnViews();
        this.cdr.detectChanges();
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }

    this.loadEmployeeData();
    this.refreshInterval = setInterval(() => this.loadEmployeeData(), 5000);
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

  loadEmployeeData(): void {
    this.http.get('/api/sedes/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.sedes = data.sedes || [];
        this.cdr.detectChanges();
      },
      error: () => this.sedes = []
    });

    this.http.get('/api/all/', { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        this.turns = data.turns || [];
        this.refreshTurnViews();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading turns:', err)
    });

    this.ws.send({ action: 'get_all' });
  }

  private get mySedeId(): string {
    return this.currentUser?.sede_id || '';
  }

  refreshTurnViews(): void {
    const sedeId = this.mySedeId;
    const myTurns = sedeId ? this.turns.filter((t: any) => t.sede_id === sedeId) : this.turns;

    this.waitingTurns = myTurns
      .filter((t: any) => t.status === 'waiting')
      .slice(0, 10);

    this.currentTurn = myTurns.find((t: any) => t.status === 'called') || null;

    this.stats = {
      waiting: myTurns.filter((t: any) => t.status === 'waiting').length,
      totalToday: myTurns.length,
      processed: myTurns.filter((t: any) => t.status === 'finished').length
    };
  }

  callNext(): void {
    this.turn.callNext().subscribe({
      next: (data: any) => {
        if (data.number) {
          this.ws.send({ action: 'get_all' });
          this.showActionModal = true;
          this.cdr.detectChanges();
        } else {
          alert('No hay turnos en espera');
        }
      },
      error: () => alert('Error al llamar turno')
    });
  }

  callSpecific(turn_number: string): void {
    this.turn.callSpecific(turn_number).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.ws.send({ action: 'get_all' });
          this.showActionModal = true;
          this.cdr.detectChanges();
        } else {
          alert(data.message || 'Error al llamar turno');
        }
      },
      error: () => alert('Error al llamar turno')
    });
  }

  finishCurrent(): void {
    this.turn.finishCurrent().subscribe({
      next: () => {
        this.showActionModal = false;
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
      },
      error: () => alert('No hay turno activo')
    });
  }

  rescheduleCurrent(): void {
    this.turn.rescheduleCurrent().subscribe({
      next: () => {
        this.showActionModal = false;
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
        this.router.navigate(['/reschedule-turns']);
      },
      error: () => alert('Error al reagendar turno')
    });
  }

  cancelCurrent(): void {
    this.turn.cancelCurrent().subscribe({
      next: () => {
        this.showActionModal = false;
        this.ws.send({ action: 'get_all' });
        this.cdr.detectChanges();
      },
      error: () => alert('Error al cancelar turno')
    });
  }

  logout(): void {
    this.auth.clearSession();
    this.auth.logout().subscribe({ next: () => {}, error: () => {} });
    this.router.navigate(['/login']);
  }

  getEmployeeName(): string {
    return this.currentUser?.full_name || this.currentUser?.username || 'Empleado';
  }

  getEmployeeSede(): string {
    return this.currentUser?.sede || 'N/A';
  }
}
