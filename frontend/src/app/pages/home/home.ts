import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TurnService } from '../../services/turn.service';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  serviceType = 'general';
  selectedSede = 'MOSQUERA';
  turnMode = 'presencial';
  userTurn: string | null = null;
  positionNum: number = 0;
  turnsAhead: number = 0;
  positionDetail: string = 'Cargando...';
  statusText: string = 'Cargando información...';
  alertShown = false;
  completed = false;
  documents: string[] = [];
  currentUser: any = null;
  showTurnModal = false;
  showCreateNew = false;
  turns: any[] = [];
  filterSede = '';
  sedes: Array<{name: string}> = [];
  sedeOptions: string[] = [];

  get waitingCount(): number {
    if (this.filterSede) {
      return this.turns.filter((t: any) => t.status === 'waiting' && t.sede === this.filterSede).length;
    }
    return this.turns.filter((t: any) => t.status === 'waiting').length;
  }

  get callingCount(): number {
    if (this.filterSede) {
      return this.turns.filter((t: any) => t.status === 'called' && t.sede === this.filterSede).length;
    }
    return this.turns.filter((t: any) => t.status === 'called').length;
  }

  get finishedCount(): number {
    if (this.filterSede) {
      return this.turns.filter((t: any) => t.status === 'finished' && t.sede === this.filterSede).length;
    }
    return this.turns.filter((t: any) => t.status === 'finished').length;
  }

  constructor(
    private auth: AuthService,
    private turn: TurnService,
    private ws: WebsocketService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
    
    const role = this.auth.getCurrentRole();
    if (!role || (role !== 'client' && role !== 'admin' && role !== 'employee')) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }

    this.http.get('/api/sedes/').subscribe({
      next: (data: any) => {
        this.sedes = data.sedes || [];
        this.sedeOptions = this.sedes.map((s: any) => s.name);
        if (this.sedeOptions.length > 0 && !this.sedeOptions.includes(this.selectedSede)) {
          this.selectedSede = this.sedeOptions[0];
        }
      },
      error: () => {
        this.sedeOptions = ['Bogota Centro', 'madrid'];
        this.selectedSede = 'Bogota Centro';
      }
    });

    this.documents = JSON.parse(localStorage.getItem('client_documents') || '[]');

    const stored = localStorage.getItem('userTurn');
    if (stored) {
      this.userTurn = stored;
      this.startPositionTracking();
    }

    this.ws.messages$.subscribe({
      next: (msg) => {
        if (Array.isArray(msg) && this.userTurn) {
          this.updatePositionFromTurns(msg);
        }
        if (Array.isArray(msg) && !this.userTurn) {
          this.turns = msg;
        }
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }
    this.ws.send({ action: 'get_all' });

    if (this.currentUser?.role === 'admin' || this.currentUser?.role === 'employee') {
      this.http.get('/api/all/').subscribe({
        next: (data: any) => {
          this.turns = data.turns || [];
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
  }

  startPositionTracking(): void {
    if (!this.ws.isConnected()) {
      this.ws.connect();
    }
    this.ws.send({ action: 'get_all' });
  }

  updatePositionFromTurns(turns: any[]): void {
    if (!this.userTurn) return;
    
    const userTurnObj = turns.find((t: any) => t.number === this.userTurn);
    if (!userTurnObj) {
      localStorage.removeItem('userTurn');
      localStorage.removeItem('turnMode');
      localStorage.removeItem('turnServiceType');
      localStorage.removeItem('turnSede');
      this.userTurn = null;
      this.showCreateNew = true;
      this.positionNum = 0;
      this.turnsAhead = 0;
      this.positionDetail = '';
      this.statusText = '';
      return;
    }

    if (userTurnObj.status === 'finished') {
      this.completed = true;
      this.positionNum = 0;
      this.turnsAhead = 0;
      this.positionDetail = 'Turno completado';
      this.statusText = 'Finalizado';
      return;
    }

    this.completed = false;
    const waitingTurns = turns
      .filter((t: any) => t.status === 'waiting' || t.status === 'called')
      .sort((a, b) => a.created_at?.localeCompare(b.created_at) || 0);
    
    const position = waitingTurns.findIndex((t: any) => t.number === this.userTurn) + 1;
    this.positionNum = position > 0 ? position : 0;
    this.turnsAhead = Math.max(0, this.positionNum - 1);

    if (this.turnsAhead === 0) {
       this.positionDetail = '¡ES TU TURNO AHORA!';
       this.statusText = 'Atendiendo';
       this.playAlertSound();
     } else if (this.turnsAhead === 1) {
       this.positionDetail = 'Siguiente turno (falta 1)';
       this.statusText = `Posición: #${this.positionNum} | Turnos adelante: 1`;
    } else if (this.turnsAhead === 2) {
      this.positionDetail = `Faltan ${this.turnsAhead} turnos`;
      this.statusText = `Posición: #${this.positionNum} | Turnos adelante: ${this.turnsAhead}`;
      if (!this.alertShown) {
        this.alertShown = true;
        this.playAlertSound();
      }
    } else {
      this.positionDetail = `Faltan ${this.turnsAhead} turnos para ti`;
      this.statusText = `Posición: #${this.positionNum} | Turnos adelante: ${this.turnsAhead}`;
      this.alertShown = false;
    }
  }

  playAlertSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
  }

  closeModal(): void {
    this.showTurnModal = false;
  }

  cancelTurn(): void {
    if (!this.userTurn) return;
    if (confirm('¿Estás seguro de cancelar tu turno?')) {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      const token = localStorage.getItem('turnify_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      this.http.delete(`${this.turn.getBaseUrl()}/cancel-turn/${this.userTurn}/`, { headers }).subscribe({
        next: () => {
          this.userTurn = null;
          this.showCreateNew = true;
          localStorage.removeItem('userTurn');
          localStorage.removeItem('turnMode');
          localStorage.removeItem('turnServiceType');
          localStorage.removeItem('turnSede');
          this.positionNum = 0;
          this.turnsAhead = 0;
          this.positionDetail = '';
          this.statusText = '';
          this.completed = false;
          this.alertShown = false;
        },
        error: () => {
          alert('Error al cancelar el turno');
        }
      });
    }
  }

  getTurn(): void {
    if (!this.serviceType) return;
    const sede = this.turnMode === 'presencial' ? this.selectedSede : 'VIRTUAL';
    const serviceType = this.turnMode === 'virtual' ? 'virtual' : this.serviceType;

    this.turn.createTurn(serviceType, sede).subscribe({
      next: (data: any) => {
        this.userTurn = data.number;
        if (this.userTurn) {
          localStorage.setItem('userTurn', this.userTurn);
          localStorage.setItem('turnMode', this.turnMode);
          localStorage.setItem('turnServiceType', serviceType);
          if (this.turnMode === 'presencial') {
            localStorage.setItem('turnSede', this.selectedSede);
          }
        }
        this.showTurnModal = true;
        this.startPositionTracking();
      },
      error: () => {
        alert('Error al solicitar turno. Intenta de nuevo.');
      }
    });
  }

  logout(): void {
    this.auth.clearSession();
    this.auth.logout().subscribe({
      next: () => {},
      error: () => {}
    });
    this.router.navigate(['/login']);
  }
}